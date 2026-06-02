import os
import time

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from catalog.models import Product, ProductImage, MAX_IMAGES_PER_PRODUCT


UNSPLASH_SEARCH_URL = 'https://api.unsplash.com/search/photos'


def _search_unsplash(query, count, access_key):
    """Return a list of (index, image_bytes) tuples for the top `count` Unsplash results."""
    resp = requests.get(
        UNSPLASH_SEARCH_URL,
        params={'query': query, 'per_page': min(count, 30), 'orientation': 'squarish'},
        headers={'Authorization': f'Client-ID {access_key}'},
        timeout=15,
    )
    resp.raise_for_status()
    results = resp.json().get('results', [])
    if not results:
        return []

    images = []
    for i, result in enumerate(results[:count]):
        try:
            img_resp = requests.get(result['urls']['regular'], timeout=30)
            img_resp.raise_for_status()
            images.append((i, img_resp.content))
        except Exception:
            pass
        time.sleep(0.2)  # small pause between image downloads
    return images


class Command(BaseCommand):
    help = (
        "Fetch images from Unsplash by product name and map them to products. "
        "Requires UNSPLASH_ACCESS_KEY env var."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=3,
            metavar='N',
            help=f'Number of images to fetch per product (default: 3, max: {MAX_IMAGES_PER_PRODUCT}).',
        )
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Delete existing images and replace with fresh ones.',
        )
        parser.add_argument(
            '--product-id',
            type=int,
            metavar='ID',
            help='Fetch images for a single product only.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show which products would be processed without downloading anything.',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=0.5,
            metavar='SECONDS',
            help='Pause between products to stay within Unsplash rate limits (default: 0.5 s).',
        )

    def handle(self, *args, **options):
        access_key = os.environ.get('UNSPLASH_ACCESS_KEY', '').strip()
        if not access_key:
            raise CommandError(
                "UNSPLASH_ACCESS_KEY env var is not set. "
                "Get a free key at https://unsplash.com/developers → New Application."
            )

        dry_run   = options['dry_run']
        overwrite = options['overwrite']
        delay     = options['delay']
        count     = min(options['count'], MAX_IMAGES_PER_PRODUCT)

        qs = Product.objects.prefetch_related('images').order_by('id')
        if options['product_id']:
            qs = qs.filter(pk=options['product_id'])
            if not qs.exists():
                raise CommandError(f"No product found with id={options['product_id']}.")

        if not overwrite:
            qs = [p for p in qs if not p.images.filter(is_primary=True).exists()]
        else:
            qs = list(qs)

        if not qs:
            self.stdout.write("All products already have a primary image. Use --overwrite to replace them.")
            return

        self.stdout.write(f"Processing {len(qs)} product(s), {count} image(s) each...\n")

        total_saved = total_skipped = total_errors = 0

        for product in qs:
            label = f"[{product.id}] {product.name}"

            if dry_run:
                self.stdout.write(f"  dry-run: would fetch {count} image(s) for {label}")
                continue

            if overwrite:
                for old_img in product.images.all():
                    old_img.image.delete(save=False)
                    old_img.delete()

            existing_count = product.images.count()
            slots = MAX_IMAGES_PER_PRODUCT - existing_count
            if slots <= 0:
                self.stdout.write(self.style.WARNING(
                    f"  {label} — already at image cap ({MAX_IMAGES_PER_PRODUCT}), skipped"
                ))
                total_skipped += 1
                continue

            to_fetch = min(count, slots)

            try:
                images = _search_unsplash(product.name, to_fetch, access_key)
            except requests.HTTPError as exc:
                self.stderr.write(self.style.ERROR(f"  {label} — Unsplash HTTP error: {exc}"))
                total_errors += 1
                time.sleep(delay)
                continue
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"  {label} — search failed: {exc}"))
                total_errors += 1
                time.sleep(delay)
                continue

            if not images:
                self.stdout.write(self.style.WARNING(f"  {label} — no results on Unsplash, skipped"))
                total_skipped += 1
                time.sleep(delay)
                continue

            slug = product.name.lower().replace(' ', '_')
            saved = 0
            for i, image_bytes in images:
                suffix = '' if i == 0 else f'_{i + 1}'
                filename = f"{slug}{suffix}.jpg"
                is_primary = (i == 0 and existing_count == 0)

                try:
                    img = ProductImage(product=product, is_primary=is_primary)
                    img.image.save(filename, ContentFile(image_bytes), save=True)
                    saved += 1
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"    image {i+1} failed: {exc}"))

            self.stdout.write(self.style.SUCCESS(f"  {label} — {saved}/{to_fetch} image(s) saved"))
            total_saved += saved
            time.sleep(delay)

        if not dry_run:
            self.stdout.write(
                f"\nDone. {total_saved} image(s) saved across products, "
                f"{total_skipped} product(s) skipped, {total_errors} error(s)."
            )
