from datetime import timedelta
from django.core.management.base import BaseCommand
from ecommerce_backend.email_utils import send_email as _send_email
from django.contrib.auth import get_user_model
from django.utils import timezone
from orders.models import Coupon
from config.models import SiteSettings
from notifications.utils import notify

User = get_user_model()


def _birthday_coupon_code(user_id, year):
    return f'BDAY-{user_id}-{year}'


def get_or_create_birthday_coupon(user, today, cfg):
    code = _birthday_coupon_code(user.pk, today.year)
    expiry = today + timedelta(days=cfg.birthday_coupon_validity_days)

    coupon, created = Coupon.objects.get_or_create(
        code=code,
        defaults={
            'discount_type': 'percentage',
            'discount_value': cfg.birthday_coupon_discount,
            'expiry_date': expiry,
            'usage_limit': 1,
            'per_user_limit': 1,
            'is_active': True,
            'user': user,
        },
    )

    if not created and not coupon.is_active:
        coupon.is_active = True
        coupon.expiry_date = expiry
        coupon.save(update_fields=['is_active', 'expiry_date'])

    return coupon


class Command(BaseCommand):
    help = 'Sends Happy Birthday emails with a personal discount coupon to users whose birthday is today.'

    def handle(self, *args, **kwargs):
        cfg = SiteSettings.get()

        if not cfg.birthday_coupon_enabled:
            self.stdout.write('Birthday coupon feature is disabled. Skipping.')
            return

        today = timezone.localdate()

        users = User.objects.filter(
            date_of_birth__month=today.month,
            date_of_birth__day=today.day,
        )

        count = 0
        for user in users:
            try:
                if user.birthday_coupon_sent_year == today.year:
                    continue

                coupon = get_or_create_birthday_coupon(user, today, cfg)
                expiry_str = coupon.expiry_date.strftime('%B %d, %Y')
                user.birthday_coupon_sent_year = today.year
                user.save(update_fields=['birthday_coupon_sent_year'])

                if cfg.email_notifications_enabled:
                    _send_email(
                        subject=f'Happy Birthday, {user.first_name or "there"}! Here\'s a gift from us',
                        message=(
                            f'Dear {user.first_name or "Valued Customer"},\n\n'
                            f'Wishing you a very Happy Birthday from all of us at {cfg.store_name}!\n\n'
                            f'To celebrate your special day, we\'re gifting you a personal {cfg.birthday_coupon_discount}% discount '
                            f'on your next purchase — valid for an entire month!\n\n'
                            f'  Your Birthday Coupon: {coupon.code}\n'
                            f'  Discount: {cfg.birthday_coupon_discount}% off any order\n'
                            f'  Valid until: {expiry_str}\n\n'
                            f'Simply enter the code at checkout to redeem your gift.\n\n'
                            f'Hope you have a wonderful day!\n\n'
                            f'— The {cfg.store_name} Team'
                        ),
                        recipient_list=[user.email],
                        from_email=cfg.from_email,
                    )
                notify(
                    user,
                    'birthday',
                    f'Happy Birthday, {user.first_name or "there"}! 🎂',
                    f'Wishing you a wonderful birthday! Use code {coupon.code} for {cfg.birthday_coupon_discount}% off — valid until {expiry_str}.',
                )
                count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Error processing birthday for {user.email}: {e}'))

        self.stdout.write(self.style.SUCCESS(f'Successfully processed {count} birthday coupons.'))
