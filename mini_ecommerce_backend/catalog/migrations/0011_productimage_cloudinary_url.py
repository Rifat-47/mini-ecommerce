from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0010_add_performance_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='productimage',
            name='cloudinary_url',
            field=models.URLField(blank=True, default=''),
        ),
    ]
