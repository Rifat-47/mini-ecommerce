from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_emaillog'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Covers: filter(user=?, is_read=False).count()  — unread-count endpoint
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(
                fields=['user', 'is_read'],
                name='notif_user_is_read_idx',
            ),
        ),
        # Covers: filter(user=?).order_by('-created_at')  — notification list endpoint
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(
                fields=['user', '-created_at'],
                name='notif_user_created_idx',
            ),
        ),
    ]
