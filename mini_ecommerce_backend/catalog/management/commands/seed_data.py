import io
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model
from catalog.models import Category, Product, ProductImage
from orders.models import Order, OrderItem, Coupon
from cart.models import CartItem, WishlistItem
from decimal import Decimal
from PIL import Image, ImageDraw, ImageFont

User = get_user_model()

# (bg_color, text_color)
PRODUCT_COLORS = [
    ('#4F46E5', '#FFFFFF'),  # indigo
    ('#0EA5E9', '#FFFFFF'),  # sky
    ('#10B981', '#FFFFFF'),  # emerald
    ('#F59E0B', '#1F2937'),  # amber
    ('#EF4444', '#FFFFFF'),  # red
    ('#8B5CF6', '#FFFFFF'),  # violet
    ('#EC4899', '#FFFFFF'),  # pink
]


def make_placeholder_image(label: str, color_pair: tuple) -> ContentFile:
    bg, fg = color_pair
    img = Image.new('RGB', (600, 600), color=bg)
    draw = ImageDraw.Draw(img)

    # Draw a lighter inner rectangle
    draw.rectangle([40, 40, 560, 560], outline=fg, width=4)

    # Write the product name (wrap long names)
    words = label.split()
    lines, line = [], []
    for w in words:
        line.append(w)
        if len(' '.join(line)) > 14:
            lines.append(' '.join(line[:-1]))
            line = [w]
    lines.append(' '.join(line))

    total_height = len(lines) * 60
    y = (600 - total_height) // 2
    for ln in lines:
        bbox = draw.textbbox((0, 0), ln)
        w = bbox[2] - bbox[0]
        draw.text(((600 - w) // 2, y), ln, fill=fg)
        y += 60

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=85)
    return ContentFile(buf.getvalue())


class Command(BaseCommand):
    help = 'Seed the database with dummy data'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding data...')

        # --- Users ---
        admin, _ = User.objects.get_or_create(
            email='admin@shop.com',
            defaults=dict(first_name='Admin', last_name='User', role='admin', is_staff=True)
        )
        admin.set_password('admin123')
        admin.save()

        customer1, _ = User.objects.get_or_create(
            email='alice@example.com',
            defaults=dict(first_name='Alice', last_name='Smith', role='customer')
        )
        customer1.set_password('pass1234')
        customer1.save()

        customer2, _ = User.objects.get_or_create(
            email='bob@example.com',
            defaults=dict(first_name='Bob', last_name='Jones', role='customer')
        )
        customer2.set_password('pass1234')
        customer2.save()

        self.stdout.write('  Users created')

        # --- Categories ---
        electronics, _ = Category.objects.get_or_create(name='Electronics', defaults={'description': 'Gadgets and devices'})
        clothing, _    = Category.objects.get_or_create(name='Clothing',    defaults={'description': 'Apparel and fashion'})
        books, _       = Category.objects.get_or_create(name='Books',       defaults={'description': 'Fiction and non-fiction'})

        self.stdout.write('  Categories created')

        # --- Products ---
        products_data = [
            dict(category=electronics, name='Wireless Headphones', price='49.99', stock=50, discount_percentage='10.00'),
            dict(category=electronics, name='Bluetooth Speaker',   price='29.99', stock=30, discount_percentage='0.00'),
            dict(category=electronics, name='USB-C Hub',           price='19.99', stock=100, discount_percentage='5.00'),
            dict(category=clothing,    name='Classic White Tee',   price='14.99', stock=200, discount_percentage='0.00'),
            dict(category=clothing,    name='Denim Jacket',        price='59.99', stock=40, discount_percentage='15.00'),
            dict(category=books,       name='Clean Code',          price='34.99', stock=25, discount_percentage='0.00'),
            dict(category=books,       name='The Pragmatic Programmer', price='39.99', stock=20, discount_percentage='0.00'),
        ]

        products = []
        for i, data in enumerate(products_data):
            p, created = Product.objects.get_or_create(name=data['name'], defaults=data)
            products.append(p)

            # Add images only for newly created products (or if none exist)
            if not p.images.exists():
                color_pair = PRODUCT_COLORS[i % len(PRODUCT_COLORS)]
                # Primary image
                primary_img = ProductImage(product=p, is_primary=True)
                img_content = make_placeholder_image(p.name, color_pair)
                filename = f"{p.name.lower().replace(' ', '_')}_primary.jpg"
                primary_img.image.save(filename, img_content, save=True)

                # Secondary image (slightly different shade)
                secondary_color = (color_pair[0], color_pair[1])
                secondary_img = ProductImage(product=p, is_primary=False)
                img_content2 = make_placeholder_image(f"{p.name} (2)", secondary_color)
                filename2 = f"{p.name.lower().replace(' ', '_')}_2.jpg"
                secondary_img.image.save(filename2, img_content2, save=True)

        self.stdout.write('  Products + images created')

        # --- Coupon ---
        coupon, _ = Coupon.objects.get_or_create(
            code='WELCOME10',
            defaults=dict(discount_type='percentage', discount_value=Decimal('10.00'), is_active=True)
        )

        self.stdout.write('  Coupon created')

        # --- Orders ---
        if not Order.objects.filter(user=customer1).exists():
            order1 = Order.objects.create(
                user=customer1,
                shipping_address='123 Main St, Dhaka, Bangladesh',
                total_amount=Decimal('79.98'),
                status='Delivered',
            )
            OrderItem.objects.create(order=order1, product=products[0], quantity=1, price_at_purchase=Decimal('44.99'))
            OrderItem.objects.create(order=order1, product=products[3], quantity=2, price_at_purchase=Decimal('14.99'))

            order2 = Order.objects.create(
                user=customer1,
                shipping_address='123 Main St, Dhaka, Bangladesh',
                total_amount=Decimal('59.99'),
                coupon=coupon,
                discount_amount=Decimal('6.00'),
                status='Pending',
            )
            OrderItem.objects.create(order=order2, product=products[4], quantity=1, price_at_purchase=Decimal('59.99'))

        if not Order.objects.filter(user=customer2).exists():
            order3 = Order.objects.create(
                user=customer2,
                shipping_address='456 Park Ave, Chittagong, Bangladesh',
                total_amount=Decimal('74.98'),
                status='In-Progress',
            )
            OrderItem.objects.create(order=order3, product=products[5], quantity=1, price_at_purchase=Decimal('34.99'))
            OrderItem.objects.create(order=order3, product=products[6], quantity=1, price_at_purchase=Decimal('39.99'))

        self.stdout.write('  Orders created')

        # --- Cart & Wishlist ---
        CartItem.objects.get_or_create(user=customer1, product=products[1], defaults={'quantity': 2})
        CartItem.objects.get_or_create(user=customer2, product=products[2], defaults={'quantity': 1})

        WishlistItem.objects.get_or_create(user=customer1, product=products[4])
        WishlistItem.objects.get_or_create(user=customer2, product=products[0])

        self.stdout.write('  Cart & wishlist items created')

        self.stdout.write(self.style.SUCCESS('\nDone! Dummy data seeded successfully.'))
        self.stdout.write('\nTest accounts:')
        self.stdout.write('  admin@shop.com    / admin123  (admin)')
        self.stdout.write('  alice@example.com / pass1234  (customer)')
        self.stdout.write('  bob@example.com   / pass1234  (customer)')
