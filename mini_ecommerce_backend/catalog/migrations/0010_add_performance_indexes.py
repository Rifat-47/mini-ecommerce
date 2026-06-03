from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0009_alter_product_status'),
    ]

    operations = [
        # Category.status — every product list query filters category__status='active'
        migrations.AlterField(
            model_name='category',
            name='status',
            field=models.CharField(
                choices=[('active', 'Active'), ('inactive', 'Inactive')],
                db_index=True,
                default='active',
                max_length=10,
            ),
        ),

        # Composite (status, category_id) on Product — covers the most common filter:
        # filter(status='active', category__status='active') with ORDER BY -id
        migrations.AddIndex(
            model_name='product',
            index=models.Index(
                fields=['status', 'category_id'],
                name='catalog_product_status_cat_idx',
            ),
        ),

        # Composite (product_id, is_primary) on ProductImage — covers the
        # prefetch + primary-image sort used on every product list response
        migrations.AddIndex(
            model_name='productimage',
            index=models.Index(
                fields=['product', 'is_primary'],
                name='cat_prodimg_prod_primary_idx',
            ),
        ),
    ]
