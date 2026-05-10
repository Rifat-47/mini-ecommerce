from django.db import models


class SiteSettings(models.Model):
    """Singleton model — always use SiteSettings.get() instead of direct queries."""

    # ── Store identity ────────────────────────────────────────────────────────
    store_name    = models.CharField(max_length=100, blank=True, default='')
    support_email = models.EmailField(blank=True, default='')
    from_email    = models.EmailField(blank=True, default='')
    contact_phone = models.CharField(max_length=30, blank=True, default='')
    currency      = models.CharField(max_length=10, default='BDT')
    tax_rate      = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # ── Orders ────────────────────────────────────────────────────────────────
    return_window_days       = models.PositiveIntegerField(default=7)
    free_shipping_threshold  = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # ── Birthday coupon ───────────────────────────────────────────────────────
    birthday_coupon_enabled         = models.BooleanField(default=True)
    birthday_coupon_discount        = models.PositiveIntegerField(default=20)
    birthday_coupon_validity_days   = models.PositiveIntegerField(default=30)

    # ── Payments ──────────────────────────────────────────────────────────────
    cod_enabled             = models.BooleanField(default=True)
    online_payment_enabled  = models.BooleanField(default=True)
    cod_min_order_value     = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # ── Notifications ─────────────────────────────────────────────────────────
    email_notifications_enabled = models.BooleanField(default=True)

    # ── Security ──────────────────────────────────────────────────────────────
    registration_enabled = models.BooleanField(default=True)
    max_login_attempts   = models.PositiveIntegerField(default=5)
    lockout_minutes      = models.PositiveIntegerField(default=15)

    class Meta:
        verbose_name = 'Site Settings'
        verbose_name_plural = 'Site Settings'

    def __str__(self):
        return self.store_name or 'Site Settings'

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass  # prevent deletion
