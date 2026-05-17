import uuid
from django.db import migrations, models


def populate_public_id(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    for order in Order.objects.filter(public_id__isnull=True):
        order.public_id = uuid.uuid4()
        order.save(update_fields=['public_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0009_alter_order_created_at_alter_order_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='public_id',
            field=models.UUIDField(db_index=True, editable=False, null=True),
        ),
        migrations.RunPython(populate_public_id, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='order',
            name='public_id',
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
