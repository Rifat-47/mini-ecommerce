from collections import defaultdict
from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Order, OrderItem, Coupon, ReturnRequest
from catalog.models import Product, Category
from catalog.serializers import _absolute_url
from catalog.stock_utils import record_stock_movement
from cart.models import CartItem
from users.models import UserAddress
from notifications.utils import notify
from ecommerce_backend.email_utils import send_mail_async as _email_async

User = get_user_model()


class CouponSerializer(serializers.ModelSerializer):
    applicable_categories = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Category.objects.all(),
        required=False,
    )
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    user_email = serializers.SerializerMethodField()

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None

    def validate_code(self, value):
        return value.strip().upper()

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'discount_type', 'discount_value',
            'expiry_date', 'usage_limit', 'per_user_limit',
            'times_used', 'is_active',
            'min_order_value', 'max_discount_amount', 'first_time_only',
            'applicable_categories', 'user', 'user_email', 'created_at',
        ]
        read_only_fields = ['id', 'times_used', 'user_email', 'created_at']
        extra_kwargs = {
            'code': {'min_length': 3, 'max_length': 50},
        }


def _apply_coupon_rules(coupon, cart_total, cart_category_ids, user, field_name='code'):
    """
    Validate all coupon constraints and return the discount amount.
    Raises ValidationError on any failure. Returns Decimal discount_amount.
    """
    valid, reason = coupon.is_valid(user=user)
    if not valid:
        raise serializers.ValidationError({field_name: reason})

    if coupon.min_order_value is not None and cart_total < coupon.min_order_value:
        raise serializers.ValidationError(
            {field_name: f"Minimum order value of BDT {coupon.min_order_value:.2f} required for this coupon."}
        )

    if coupon.first_time_only:
        if Order.objects.filter(user=user).exists():
            raise serializers.ValidationError({field_name: "This coupon is only valid for first-time orders."})

    restricted_cats = set(coupon.applicable_categories.values_list('id', flat=True))
    if restricted_cats and not restricted_cats.intersection(cart_category_ids):
        raise serializers.ValidationError({field_name: "This coupon is not applicable to the items in your cart."})

    if coupon.discount_type == 'free_shipping':
        discount_amount = Decimal('0.00')
    elif coupon.discount_type == 'percentage':
        discount_amount = (cart_total * coupon.discount_value / Decimal('100')).quantize(Decimal('0.01'))
        if coupon.max_discount_amount is not None:
            discount_amount = min(discount_amount, coupon.max_discount_amount)
    else:  # fixed
        discount_amount = min(coupon.discount_value, cart_total)
        if coupon.max_discount_amount is not None:
            discount_amount = min(discount_amount, coupon.max_discount_amount)

    return discount_amount


class CouponValidateSerializer(serializers.Serializer):
    code = serializers.CharField()
    cart_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    category_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
        help_text="List of category IDs of products in the cart (for category-restricted coupons)."
    )

    def validate(self, attrs):
        code = attrs['code'].strip().upper()
        cart_total = attrs['cart_total']
        user = self.context['request'].user
        category_ids = set(attrs.get('category_ids', []))

        try:
            coupon = Coupon.objects.prefetch_related('applicable_categories').get(code__iexact=code)
        except Coupon.DoesNotExist:
            raise serializers.ValidationError({"code": "Invalid coupon code."})

        discount_amount = _apply_coupon_rules(coupon, cart_total, category_ids, user, field_name='code')

        attrs['coupon'] = coupon
        attrs['discount_amount'] = discount_amount
        attrs['final_total'] = (cart_total - discount_amount).quantize(Decimal('0.01'))
        return attrs


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_image = serializers.SerializerMethodField()

    def get_product_image(self, obj):
        request = self.context.get('request')
        images = sorted(obj.product.images.all(), key=lambda img: not img.is_primary)
        image = images[0] if images else None
        if image:
            return _absolute_url(image.image.url, request)
        return None

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_image', 'quantity', 'price_at_purchase']
        read_only_fields = ['price_at_purchase']


def _user_display(user, fallback='[deleted user]'):
    """Return email or fallback when order.user has been deleted (GDPR SET_NULL)."""
    return user.email if user else fallback


def _user_name(user):
    return (user.first_name or user.email) if user else '[deleted user]'


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    user_email = serializers.SerializerMethodField()

    def get_user_email(self, obj):
        return _user_display(obj.user)
    coupon_code = serializers.CharField(write_only=True, required=False, allow_blank=True)
    address_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    applied_coupon = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'public_id', 'user', 'user_email', 'shipping_address',
            'address_id', 'coupon_code', 'applied_coupon', 'discount_amount',
            'total_amount', 'status', 'created_at', 'items',
        ]
        read_only_fields = ['user', 'public_id', 'discount_amount', 'total_amount', 'status', 'created_at']
        extra_kwargs = {
            'shipping_address': {'required': False, 'allow_blank': True},
        }

    def get_applied_coupon(self, obj):
        if obj.coupon:
            return {
                'code': obj.coupon.code,
                'discount_type': obj.coupon.discount_type,
                'discount_value': str(obj.coupon.discount_value),
            }
        return None

    def validate(self, attrs):
        coupon_code = attrs.pop('coupon_code', '').strip().upper()
        address_id = attrs.pop('address_id', None)
        attrs['_coupon'] = None

        # Resolve shipping address from saved address book
        if address_id is not None:
            user = self.context['request'].user
            try:
                addr = UserAddress.objects.get(pk=address_id, user=user)
            except UserAddress.DoesNotExist:
                raise serializers.ValidationError({"address_id": "Address not found."})
            parts = [addr.full_name, addr.phone, addr.address_line_1]
            if addr.address_line_2:
                parts.append(addr.address_line_2)
            parts += [addr.city, addr.state, addr.postal_code, addr.country]
            attrs['shipping_address'] = ', '.join(parts)
        elif not attrs.get('shipping_address', '').strip():
            raise serializers.ValidationError({"shipping_address": "Provide either address_id or shipping_address."})

        if coupon_code:
            user = self.context['request'].user
            try:
                coupon = Coupon.objects.prefetch_related('applicable_categories').get(code__iexact=coupon_code)
            except Coupon.DoesNotExist:
                raise serializers.ValidationError({"coupon_code": "Invalid coupon code."})

            # Basic eligibility checks (active, expiry, usage limits, first_time, categories)
            # min_order_value is checked in create() once we have the exact subtotal.
            valid, reason = coupon.is_valid(user=user)
            if not valid:
                raise serializers.ValidationError({"coupon_code": reason})

            if coupon.first_time_only and Order.objects.filter(user=user).exists():
                raise serializers.ValidationError({"coupon_code": "This coupon is only valid for first-time orders."})

            order_category_ids = {
                item['product'].category_id
                for item in attrs.get('items', [])
                if item['product'].category_id is not None
            }
            restricted_cats = set(coupon.applicable_categories.values_list('id', flat=True))
            if restricted_cats and not restricted_cats.intersection(order_category_ids):
                raise serializers.ValidationError({"coupon_code": "This coupon is not applicable to the items in your cart."})

            attrs['_coupon'] = coupon

        # Stock validation — aggregate quantities per product to handle duplicates.
        # select_for_update is deferred to create() which runs inside a transaction.
        items = attrs.get('items', [])
        product_ids = [item['product'].pk for item in items]
        from catalog.models import Product as ProductModel
        products_by_id = {
            p.pk: p for p in ProductModel.objects.filter(pk__in=product_ids)
        }
        qty_needed = defaultdict(int)
        for item in items:
            qty_needed[item['product'].pk] += item['quantity']

        errors = []
        for pid, needed in qty_needed.items():
            product = products_by_id[pid]
            if product.stock < needed:
                errors.append(f"'{product.name}' only has {product.stock} unit(s) in stock.")
        if errors:
            raise serializers.ValidationError({"items": errors})

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        coupon = validated_data.pop('_coupon', None)
        user = self.context['request'].user

        order = Order.objects.create(user=user, **validated_data)

        # Re-fetch products under lock inside the transaction to prevent race conditions
        from catalog.models import Product as ProductModel
        product_ids = [item['product'].pk for item in items_data]
        locked_products = {
            p.pk: p for p in ProductModel.objects.select_for_update().filter(pk__in=product_ids)
        }

        subtotal = Decimal('0.00')
        for item_data in items_data:
            product = locked_products[item_data['product'].pk]
            quantity = item_data['quantity']
            unit_price = product.price - (product.price * product.discount_percentage / 100)
            if unit_price < 0:
                unit_price = Decimal('0.00')

            price_at_purchase = unit_price * quantity

            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                price_at_purchase=price_at_purchase,
            )
            subtotal += price_at_purchase
            if product.stock >= quantity:
                record_stock_movement(
                    product, 'sale', -quantity,
                    reason=f'Order #{order.id} placed',
                )

        discount_amount = Decimal('0.00')
        if coupon:
            if coupon.min_order_value is not None and subtotal < coupon.min_order_value:
                raise serializers.ValidationError(
                    {"coupon_code": f"Minimum order value of BDT {coupon.min_order_value:.2f} required for this coupon."}
                )

            item_category_ids = set(
                OrderItem.objects.filter(order=order)
                .values_list('product__category_id', flat=True)
            )
            if coupon.discount_type == 'free_shipping':
                discount_amount = Decimal('0.00')
            elif coupon.discount_type == 'percentage':
                discount_amount = (subtotal * coupon.discount_value / Decimal('100')).quantize(Decimal('0.01'))
                if coupon.max_discount_amount is not None:
                    discount_amount = min(discount_amount, coupon.max_discount_amount)
            else:  # fixed
                discount_amount = min(coupon.discount_value, subtotal)
                if coupon.max_discount_amount is not None:
                    discount_amount = min(discount_amount, coupon.max_discount_amount)

            coupon.times_used += 1
            coupon.save()
            order.coupon = coupon

        order.discount_amount = discount_amount
        order.total_amount = max(subtotal - discount_amount, Decimal('0.00'))
        order.save()

        # Clear the user's cart after successful checkout
        CartItem.objects.filter(user=user).delete()

        # Capture values needed by the post-commit callback before the
        # transaction closes (avoids lazy-loading on a potentially stale instance).
        order_id = order.id
        order_total = order.total_amount
        user_email = user.email
        user_name = user.first_name or user.email

        def _send_confirmation():
            from config.models import SiteSettings
            cfg = SiteSettings.get()
            notify(user, 'order_placed', f'Order #{order_id} Placed',
                   f'Your order #{order_id} has been placed successfully! Total: BDT {order_total:.2f}.')
            if cfg.email_notifications_enabled:
                _email_async(
                    'Order Confirmation',
                    (
                        f'Hi {user_name},\n\n'
                        f'Your order #{order_id} has been placed successfully!\n'
                        f'Total: {cfg.currency} {order_total}\n\n'
                        f'— The {cfg.store_name} Team'
                    ),
                    cfg.from_email,
                    [user_email],
                )

        # Run email + notification after the transaction commits so that:
        # 1. DB locks on products/order are released before SMTP starts.
        # 2. If the transaction rolls back, no confirmation is sent.
        transaction.on_commit(_send_confirmation)

        return order


STATUS_EMAIL_TEMPLATES = {
    'In-Progress': {
        'subject': 'Your Order Is Being Processed — #{order_id}',
        'body': (
            'Hi {name},\n\n'
            'Great news! Your order #{order_id} is now in progress and being prepared for shipment.\n\n'
            'Order Total: {total}\n\n'
            'We will notify you once it has been delivered.\n\n'
            '— The {store_name} Team'
        ),
    },
    'Delivered': {
        'subject': 'Your Order Has Been Delivered — #{order_id}',
        'body': (
            'Hi {name},\n\n'
            'Your order #{order_id} has been marked as delivered. We hope you enjoy your purchase!\n\n'
            'Order Total: {total}\n\n'
            'If you have any issues, please contact our support team.\n\n'
            '— The {store_name} Team'
        ),
    },
    'Cancelled': {
        'subject': 'Your Order Has Been Cancelled — #{order_id}',
        'body': (
            'Hi {name},\n\n'
            'Your order #{order_id} has been cancelled by our team.\n\n'
            'If you have any questions, please contact our support team.\n\n'
            '— The {store_name} Team'
        ),
    },
}


ADMIN_ALLOWED_STATUSES = {'Pending', 'In-Progress', 'Delivered', 'Cancelled'}


class AdminOrderUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['status']

    def validate_status(self, value):
        if value not in ADMIN_ALLOWED_STATUSES:
            raise serializers.ValidationError(
                f"'{value}' is not a valid status for this endpoint. "
                f"Return statuses are managed via the returns endpoints."
            )
        return value

    def update(self, instance, validated_data):
        new_status = validated_data.get('status', instance.status)
        status_changed = new_status != instance.status

        if new_status == 'Cancelled' and status_changed:
            instance.cancel()
        else:
            instance = super().update(instance, validated_data)

        if status_changed and new_status in STATUS_EMAIL_TEMPLATES and instance.user:
            from config.models import SiteSettings
            cfg = SiteSettings.get()
            if cfg.email_notifications_enabled:
                template = STATUS_EMAIL_TEMPLATES[new_status]
                _email_async(
                    template['subject'].format(order_id=instance.id),
                    template['body'].format(
                        name=_user_name(instance.user),
                        order_id=instance.id,
                        total=instance.total_amount,
                        store_name=cfg.store_name,
                    ),
                    cfg.from_email,
                    [instance.user.email],
                )

        if status_changed:
            notify(instance.user, 'order_status', f'Order #{instance.id} — {new_status}',
                   f'Your order #{instance.id} status has been updated to "{new_status}".')

        return instance


class ReturnRequestSerializer(serializers.ModelSerializer):
    order_id = serializers.ReadOnlyField(source='order.id')
    order_total = serializers.ReadOnlyField(source='order.total_amount')

    class Meta:
        model = ReturnRequest
        fields = [
            'id', 'order_id', 'order_total',
            'reason', 'status', 'admin_note',
            'refund_status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'order_id', 'order_total', 'status', 'admin_note', 'refund_status', 'created_at', 'updated_at']
        extra_kwargs = {
            'reason': {'min_length': 10, 'max_length': 1000},
        }


class AdminReturnUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnRequest
        fields = ['status', 'admin_note']

    def validate_status(self, value):
        if value not in ('approved', 'rejected'):
            raise serializers.ValidationError("Status must be 'approved' or 'rejected'.")
        return value

    def update(self, instance, validated_data):
        new_status = validated_data.get('status', instance.status)
        status_changed = new_status != instance.status
        instance = super().update(instance, validated_data)

        if status_changed:
            order = instance.order

            if new_status == 'approved':
                order.status = 'Return-Approved'
                order.save(update_fields=['status'])
                instance.refund_status = 'pending'
                instance.save(update_fields=['refund_status'])

                if order.user:
                    from config.models import SiteSettings
                    cfg = SiteSettings.get()
                    if cfg.email_notifications_enabled:
                        _email_async(
                            f'Your Return Request Has Been Approved — Order #{order.id}',
                            (
                                f'Hi {_user_name(order.user)},\n\n'
                                f'Your return request for Order #{order.id} has been approved.\n'
                                f'Your refund of BDT {order.total_amount:.2f} is being processed and will be '
                                f'credited to your original payment method within 3–7 business days.\n\n'
                                f'— The {cfg.store_name} Team'
                            ),
                            cfg.from_email,
                            [order.user.email],
                        )
                    notify(order.user, 'return_approved', f'Return Approved — Order #{order.id}',
                           f'Your return request for Order #{order.id} has been approved. Refund is being processed.')
            else:
                order.status = 'Delivered'
                order.save(update_fields=['status'])

                if order.user:
                    from config.models import SiteSettings
                    cfg = SiteSettings.get()
                    if cfg.email_notifications_enabled:
                        _email_async(
                            f'Your Return Request Has Been Rejected — Order #{order.id}',
                            (
                                f'Hi {_user_name(order.user)},\n\n'
                                f'Unfortunately, your return request for Order #{order.id} has been rejected.\n'
                                f'Reason: {instance.admin_note or "No reason provided."}\n\n'
                                f'If you have questions, please contact our support team.\n\n'
                                f'— The {cfg.store_name} Team'
                            ),
                            cfg.from_email,
                            [order.user.email],
                        )
                    notify(order.user, 'return_rejected', f'Return Rejected — Order #{order.id}',
                           f'Your return request for Order #{order.id} has been rejected. Reason: {instance.admin_note or "No reason provided."}')

        return instance
