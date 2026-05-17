from rest_framework import serializers
from django.db import transaction
from .models import WishlistItem, CartItem


class WishlistItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_price = serializers.ReadOnlyField(source='product.price')
    product_discount_percentage = serializers.ReadOnlyField(source='product.discount_percentage')
    product_stock = serializers.ReadOnlyField(source='product.stock')
    product_image = serializers.SerializerMethodField()

    class Meta:
        model = WishlistItem
        fields = ['id', 'product', 'product_name', 'product_price', 'product_discount_percentage', 'product_stock', 'product_image', 'added_at']

    def get_product_image(self, obj):
        img = obj.product.images.filter(is_primary=True).first()
        if not img:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(img.image.url) if request else img.image.url
        read_only_fields = ['id', 'added_at']

    def validate_product(self, product):
        user = self.context['request'].user
        if WishlistItem.objects.filter(user=user, product=product).exists():
            raise serializers.ValidationError("This product is already in your wishlist.")
        return product

    def create(self, validated_data):
        return WishlistItem.objects.create(user=self.context['request'].user, **validated_data)


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_price = serializers.ReadOnlyField(source='product.price')
    product_discount_percentage = serializers.ReadOnlyField(source='product.discount_percentage')
    product_stock = serializers.ReadOnlyField(source='product.stock')
    product_image = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_name', 'product_price', 'product_discount_percentage', 'product_stock', 'product_image', 'quantity', 'line_total', 'added_at']

    def get_product_image(self, obj):
        img = obj.product.images.filter(is_primary=True).first()
        if not img:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(img.image.url) if request else img.image.url
        read_only_fields = ['id', 'added_at']

    def get_line_total(self, obj):
        unit_price = obj.product.price - (obj.product.price * obj.product.discount_percentage / 100)
        if unit_price < 0:
            unit_price = 0
        return round(unit_price * obj.quantity, 2)

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate(self, attrs):
        product = attrs.get('product', getattr(self.instance, 'product', None))
        quantity = attrs.get('quantity', getattr(self.instance, 'quantity', 1))
        if product and product.stock < quantity:
            raise serializers.ValidationError({"quantity": f"Only {product.stock} units available in stock."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context['request'].user
        quantity = validated_data.get('quantity', 1)

        # Re-fetch product under lock to prevent race conditions
        from catalog.models import Product
        product = Product.objects.select_for_update().get(pk=validated_data['product'].pk)

        if product.stock < quantity:
            raise serializers.ValidationError({"quantity": f"Only {product.stock} units available in stock."})

        cart_item, created = CartItem.objects.get_or_create(
            user=user,
            product=product,
            defaults={'quantity': quantity},
        )
        if not created:
            new_quantity = cart_item.quantity + quantity
            if product.stock < new_quantity:
                raise serializers.ValidationError({"quantity": f"Only {product.stock} units available in stock."})
            cart_item.quantity = new_quantity
            cart_item.save()

        return cart_item
