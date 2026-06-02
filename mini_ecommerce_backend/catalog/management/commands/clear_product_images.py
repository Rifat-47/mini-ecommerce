from django.core.management.base import BaseCommand

from catalog.models import ProductImage


class Command(BaseCommand):
    help = "Delete all product images (via the configured storage backend) and remove ProductImage DB records."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting anything.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        images = ProductImage.objects.select_related('product').all()
        count = images.count()

        self.stdout.write(f"Found {count} ProductImage record(s).")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — nothing deleted."))
            for img in images:
                self.stdout.write(f"  would delete: [{img.product.name}] {img.image.name}")
            return

        deleted_files = 0
        for img in images:
            try:
                img.image.delete(save=False)
                deleted_files += 1
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"  failed to delete file {img.image.name}: {exc}"))

        deleted_db, _ = ProductImage.objects.all().delete()

        self.stdout.write(self.style.SUCCESS(
            f"Done. Deleted {deleted_files} file(s) from storage and {deleted_db} DB record(s)."
        ))
