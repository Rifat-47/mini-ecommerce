import urllib.parse

import psycopg2
import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from catalog.models import Category, Product, ProductImage

STAGING_DB_URL = (
    "postgresql://neondb_owner:npg_l9GvAugQFm4t"
    "@ep-jolly-tree-a4i8s3gc.us-east-1.aws.neon.tech/neondb?sslmode=require"
)


def _connect_staging():
    parsed = urllib.parse.urlparse(STAGING_DB_URL)
    return psycopg2.connect(
        dbname=parsed.path.lstrip('/'),
        user=parsed.username,
        password=parsed.password,
        host=parsed.hostname,
        port=parsed.port or 5432,
        sslmode='require',
    )


class Command(BaseCommand):
    help = (
        "Delete all local categories/products/images and re-create them "
        "from the staging (Neon) database, downloading images locally."
    )

    def handle(self, *args, **options):
        # ── 1. Clear local data ──────────────────────────────────────────────
        self.stdout.write("Clearing local catalog data...")

        for img in ProductImage.objects.all():
            try:
                img.image.delete(save=False)
            except Exception:
                pass
        ProductImage.objects.all().delete()
        Product.objects.all().delete()
        Category.objects.all().delete()

        self.stdout.write(self.style.SUCCESS("  Local catalog cleared."))

        # ── 2. Connect to staging ────────────────────────────────────────────
        self.stdout.write("Connecting to staging database...")
        conn = _connect_staging()
        cur = conn.cursor()

        # ── 3. Fetch & create categories ─────────────────────────────────────
        cur.execute("SELECT id, name, description, status FROM catalog_category ORDER BY id")
        staging_categories = cur.fetchall()

        id_map_category = {}  # staging_id → local Category
        for sid, name, description, status in staging_categories:
            cat = Category.objects.create(name=name, description=description, status=status)
            id_map_category[sid] = cat

        self.stdout.write(self.style.SUCCESS(f"  {len(id_map_category)} categories created."))

        # ── 4. Fetch & create products ────────────────────────────────────────
        cur.execute(
            "SELECT id, category_id, name, description, price, discount_percentage, stock, status "
            "FROM catalog_product ORDER BY id"
        )
        staging_products = cur.fetchall()

        id_map_product = {}  # staging_id → local Product
        for sid, cat_id, name, description, price, discount, stock, status in staging_products:
            cat = id_map_category.get(cat_id)
            if cat is None:
                self.stderr.write(self.style.WARNING(f"  skipping product '{name}': category {cat_id} not found"))
                continue
            prod = Product.objects.create(
                category=cat,
                name=name,
                description=description,
                price=price,
                discount_percentage=discount,
                stock=stock,
                status=status,
            )
            id_map_product[sid] = prod

        self.stdout.write(self.style.SUCCESS(f"  {len(id_map_product)} products created."))

        # ── 5. Fetch & download images ────────────────────────────────────────
        cur.execute(
            "SELECT product_id, image, is_primary FROM catalog_productimage ORDER BY product_id, is_primary DESC"
        )
        staging_images = cur.fetchall()
        cur.close()
        conn.close()

        self.stdout.write(f"Downloading {len(staging_images)} image(s) from Cloudinary...")

        saved = skipped = errors = 0
        for product_id, image_name, is_primary in staging_images:
            product = id_map_product.get(product_id)
            if product is None:
                skipped += 1
                continue

            # Build Cloudinary URL from the stored name
            # image_name is like "product_images/iphone_15_pro.jpg"
            public_id = image_name.replace('\\', '/').rsplit('.', 1)[0]
            url = f"https://res.cloudinary.com/dv58li7ua/image/upload/{public_id}.jpg"

            try:
                resp = requests.get(url, timeout=30)
                resp.raise_for_status()
                filename = image_name.replace('\\', '/').split('/')[-1]
                img = ProductImage(product=product, is_primary=is_primary)
                img.image.save(filename, ContentFile(resp.content), save=True)
                saved += 1
                self.stdout.write(f"  [{product.name}] {filename}")
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"  failed [{product.name}] {image_name}: {exc}"))
                errors += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {len(id_map_category)} categories, {len(id_map_product)} products, "
            f"{saved} images saved, {skipped} skipped, {errors} errors."
        ))
