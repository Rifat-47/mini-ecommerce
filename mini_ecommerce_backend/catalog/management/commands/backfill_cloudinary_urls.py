from django.core.management.base import BaseCommand

from catalog.models import ProductImage


class Command(BaseCommand):
    help = "Populate cloudinary_url on ProductImage rows that have an empty value."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print what would be updated without writing to the DB.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        images = ProductImage.objects.filter(cloudinary_url='').select_related('product')
        total = images.count()
        self.stdout.write(f"Found {total} image(s) with empty cloudinary_url.")

        updated = skipped = errors = 0
        for img in images:
            try:
                url = img.image.url
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"  [{img.product.name}] could not resolve URL: {exc}"))
                errors += 1
                continue

            if not url.startswith('https://'):
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(f"  would set [{img.product.name}] → {url}")
                updated += 1
                continue

            ProductImage.objects.filter(pk=img.pk).update(cloudinary_url=url)
            img.cloudinary_url = url
            updated += 1

        action = 'Would update' if dry_run else 'Updated'
        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {action} {updated}, skipped {skipped} (local URLs), {errors} error(s)."
        ))
