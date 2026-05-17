import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from catalog.models import Product
from django.contrib.auth import get_user_model


class Coupon(models.Model):
    DISCOUNT_TYPE_CHOICES = (
        ('percentage',   'Percentage'),
        ('fixed',        'Fixed Amount'),
        ('free_shipping','Free Shipping'),
    )
    code                  = models.CharField(max_length=50, unique=True)
    discount_type         = models.CharField(max_length=15, choices=DISCOUNT_TYPE_CHOICES)
    discount_value        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expiry_date           = models.DateField(null=True, blank=True)
    usage_limit           = models.PositiveIntegerField(null=True, blank=True, help_text="Total uses allowed across all customers. Leave blank for unlimited.")
    per_user_limit        = models.PositiveIntegerField(null=True, blank=True, help_text="Max times a single customer can use this coupon. Leave blank for unlimited.")
    times_used            = models.PositiveIntegerField(default=0)
    is_active             = models.BooleanField(default=True)
    # Enhancements
    min_order_value       = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Minimum cart total required to use this coupon.")
    max_discount_amount   = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Maximum discount that can be applied (caps percentage discounts).")
    first_time_only       = models.BooleanField(default=False, help_text="Restrict to customers who have never placed an order.")
    applicable_categories = models.ManyToManyField('catalog.Category', blank=True, related_name='coupons', help_text="Restrict to products in these categories. Leave empty to apply to all products.")
    user                  = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='personal_coupons', help_text="Assign to a specific user. Leave blank for public coupons.")
    created_at            = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.code

    def is_valid(self, user=None):
        if not self.is_active:
            return False, "This coupon is inactive."
        if self.expiry_date and self.expiry_date < timezone.now().date():
            return False, "This coupon has expired."
        if self.usage_limit is not None and self.times_used >= self.usage_limit:
            return False, "This coupon has reached its usage limit."
        if user is not None and self.per_user_limit is not None:
            user_uses = Order.objects.filter(user=user, coupon=self).count()
            if user_uses >= self.per_user_limit:
                return False, "You have reached the usage limit for this coupon."
        return True, None


class Order(models.Model):
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('In-Progress', 'In-Progress'),
        ('Delivered', 'Delivered'),
        ('Cancelled', 'Cancelled'),
        ('Return-Requested', 'Return Requested'),
        ('Return-Approved', 'Return Approved'),
        ('Returned', 'Returned'),
    )
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    shipping_address = models.TextField()
    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"Order {self.id} by {self.user.email}"

    def save(self, *args, **kwargs):
        if self.pk:
            old_status = Order.objects.filter(pk=self.pk).values_list('status', flat=True).first()
            if old_status != 'Returned' and self.status == 'Returned':
                from catalog.stock_utils import record_stock_movement
                for item in self.items.select_related('product').all():
                    record_stock_movement(
                        item.product, 'return', item.quantity,
                        reason=f'Order #{self.id} returned — stock restocked',
                    )
            if old_status != 'Delivered' and self.status == 'Delivered':
                try:
                    payment = self.payment
                    if payment.payment_method == 'cash_on_delivery' and payment.status == 'pending':
                        payment.status = 'completed'
                        payment.save(update_fields=['status'])
                except Exception:
                    pass
        super().save(*args, **kwargs)

    def cancel(self):
        """Cancel the order and restore stock for all items."""
        from catalog.stock_utils import record_stock_movement
        for item in self.items.select_related('product').all():
            record_stock_movement(
                item.product, 'cancel', item.quantity,
                reason=f'Order #{self.id} cancelled',
            )
        self.status = 'Cancelled'
        self.save()


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    price_at_purchase = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"


class ReturnRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    REFUND_STATUS_CHOICES = (
        ('not_initiated', 'Not Initiated'),
        ('pending', 'Pending'),
        ('completed', 'Completed'),
    )

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='return_request')
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(blank=True, default='')
    refund_status = models.CharField(max_length=20, choices=REFUND_STATUS_CHOICES, default='not_initiated')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ReturnRequest — Order #{self.order_id} — {self.status}"


class DashboardStats(Order):
    """
    Proxy model — no DB table. Exists solely to attach a custom
    admin page for dashboard stats under the Orders section.
    """
    class Meta:
        proxy = True
        verbose_name = 'Dashboard Stats'
        verbose_name_plural = 'Dashboard Stats'
