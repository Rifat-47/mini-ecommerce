from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_alter_user_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='birthday_coupon_sent_year',
            field=models.SmallIntegerField(blank=True, null=True),
        ),
    ]
