from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

class Category(models.Model):
    STATUS_CHOICES = (('active', 'Active'), ('inactive', 'Inactive'))

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Product(models.Model):
    STATUS_CHOICES = (('active', 'Active'), ('inactive', 'Inactive'))

    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    stock = models.IntegerField(default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active', db_index=True)

    def __str__(self):
        return self.name

MAX_IMAGES_PER_PRODUCT = 5
LOW_STOCK_THRESHOLD = 10

class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='product_images/')
    is_primary = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.product.name} ({'primary' if self.is_primary else 'secondary'})"

    def save(self, *args, **kwargs):
        # If this image is being set as primary, demote any existing primary
        if self.is_primary:
            ProductImage.objects.filter(product=self.product, is_primary=True).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)


class Review(models.Model):
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='reviews', on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('product', 'user')

    def __str__(self):
        return f"Review by {self.user.email} on {self.product.name} ({self.rating}/5)"


class StockMovement(models.Model):
    CHANGE_TYPE_CHOICES = [
        ('sale',            'Sale (Order Placed)'),
        ('cancel',          'Stock Restored (Order Cancelled)'),
        ('return',          'Stock Restored (Return Approved)'),
        ('manual_add',      'Manual Adjustment — Add'),
        ('manual_remove',   'Manual Adjustment — Remove'),
        ('bulk_update',     'Bulk Update'),
    ]

    product         = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_movements')
    change_type     = models.CharField(max_length=20, choices=CHANGE_TYPE_CHOICES)
    quantity_change = models.IntegerField(help_text="Positive = stock added, negative = stock removed.")
    stock_after     = models.IntegerField(help_text="Stock level immediately after this movement.")
    reason          = models.TextField(blank=True, default='')
    created_by      = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='stock_movements')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        sign = '+' if self.quantity_change >= 0 else ''
        return f"[{self.change_type}] {self.product.name} {sign}{self.quantity_change} → {self.stock_after}"