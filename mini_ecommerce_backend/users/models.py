from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'superadmin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    ROLE_CHOICES = (
        ('superadmin', 'Super Admin'),
        ('admin', 'Admin'),
        ('customer', 'Customer'),
    )
    username = None  # Remove username field
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=25, blank=True)
    last_name = models.CharField(max_length=25, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
    date_of_birth = models.DateField(null=True, blank=True)
    birthday_coupon_sent_year = models.SmallIntegerField(null=True, blank=True)

    # Account lockout
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    lockout_until = models.DateTimeField(null=True, blank=True)

    # 2FA
    totp_secret   = models.CharField(max_length=64, blank=True, default='')
    totp_enabled  = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email

    # ── Lockout helpers ──────────────────────────────────────────────────────
    # Fallback values used only before config app is ready (e.g. during migrations)
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_MINUTES = 15

    @staticmethod
    def _cfg():
        try:
            from config.models import SiteSettings
            return SiteSettings.get()
        except Exception:
            return None

    def is_locked_out(self):
        from django.utils import timezone
        if self.lockout_until and self.lockout_until > timezone.now():
            return True
        if self.lockout_until:
            self.failed_login_attempts = 0
            self.lockout_until = None
            self.save(update_fields=['failed_login_attempts', 'lockout_until'])
        return False

    def record_failed_login(self):
        from django.utils import timezone
        from datetime import timedelta
        cfg = self._cfg()
        max_attempts = cfg.max_login_attempts if cfg else self.MAX_FAILED_ATTEMPTS
        lockout_mins = cfg.lockout_minutes if cfg else self.LOCKOUT_MINUTES
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= max_attempts:
            self.lockout_until = timezone.now() + timedelta(minutes=lockout_mins)
        self.save(update_fields=['failed_login_attempts', 'lockout_until'])

    def reset_failed_login(self):
        if self.failed_login_attempts or self.lockout_until:
            self.failed_login_attempts = 0
            self.lockout_until = None
            self.save(update_fields=['failed_login_attempts', 'lockout_until'])


class UserAddress(models.Model):
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=50, blank=True, default='', help_text="e.g. Home, Work, Office")
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)
    is_default_shipping = models.BooleanField(default=False)
    is_default_billing = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} — {self.address_line_1}, {self.city} ({self.user.email})"

    def set_as_default_shipping(self):
        UserAddress.objects.filter(user=self.user, is_default_shipping=True).update(is_default_shipping=False)
        self.is_default_shipping = True
        self.save()

    def set_as_default_billing(self):
        UserAddress.objects.filter(user=self.user, is_default_billing=True).update(is_default_billing=False)
        self.is_default_billing = True
        self.save()


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('order_status_update',  'Order Status Update'),
        ('order_bulk_update',    'Order Bulk Update'),
        ('return_decision',      'Return Decision'),
        ('refund_marked',        'Refund Marked Complete'),
        ('product_create',       'Product Created'),
        ('product_update',       'Product Updated'),
        ('product_delete',       'Product Deleted'),
        ('product_bulk_update',  'Product Bulk Update'),
        ('stock_adjust',         'Stock Manual Adjustment'),
        ('user_create',          'User Created'),
        ('user_update',          'User Updated'),
        ('user_delete',          'User Deleted'),
        ('coupon_create',        'Coupon Created'),
        ('coupon_update',        'Coupon Updated'),
        ('coupon_delete',        'Coupon Deleted'),
    ]

    admin       = models.ForeignKey('User', null=True, on_delete=models.SET_NULL, related_name='audit_logs')
    action      = models.CharField(max_length=30, choices=ACTION_CHOICES)
    target_type = models.CharField(max_length=50, help_text="e.g. 'Order', 'Product', 'User'")
    target_id   = models.PositiveIntegerField(null=True, blank=True)
    detail      = models.TextField(blank=True, default='', help_text="Human-readable summary of what changed.")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.action}] by {self.admin} on {self.target_type} #{self.target_id}"
