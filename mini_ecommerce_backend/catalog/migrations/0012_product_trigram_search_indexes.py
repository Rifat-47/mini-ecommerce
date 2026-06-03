from django.contrib.postgres.indexes import GinIndex
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0011_productimage_cloudinary_url'),
    ]

    operations = [
        # pg_trgm enables trigram similarity operators and makes GIN indexes
        # support ILIKE '%query%' lookups via index scans instead of seq scans.
        migrations.RunSQL(
            sql='CREATE EXTENSION IF NOT EXISTS pg_trgm;',
            reverse_sql='DROP EXTENSION IF EXISTS pg_trgm;',
        ),

        # GIN + gin_trgm_ops on name — covers SearchFilter and ProductSuggestionsView
        migrations.AddIndex(
            model_name='product',
            index=GinIndex(
                fields=['name'],
                name='catalog_product_name_trgm_idx',
                opclasses=['gin_trgm_ops'],
            ),
        ),

        # GIN + gin_trgm_ops on description — covers full-text search path
        migrations.AddIndex(
            model_name='product',
            index=GinIndex(
                fields=['description'],
                name='catalog_product_desc_trgm_idx',
                opclasses=['gin_trgm_ops'],
            ),
        ),
    ]
