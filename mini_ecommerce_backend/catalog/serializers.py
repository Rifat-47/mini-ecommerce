from rest_framework import serializers
from django.db.models import Avg
from orders.models import Order
from .models import Category, Product, ProductImage, Review, StockMovement, MAX_IMAGES_PER_PRODUCT


def _absolute_url(url, request):
    if not url:
        return url
    if url.startswith('http://') or url.startswith('https://'):
        return url
    return request.build_absolute_uri(url) if request else url


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        extra_kwargs = {
            'name': {'min_length': 2, 'max_length': 100},
            'description': {'max_length': 2000, 'required': False},
        }


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'cloudinary_url', 'is_primary', 'uploaded_at']
        read_only_fields = ['id', 'cloudinary_url', 'uploaded_at']

    def validate(self, attrs):
        product = self.context['product']
        # Only check limit on new uploads, not on PATCH (set primary)
        if self.instance is None:
            existing_count = ProductImage.objects.filter(product=product).count()
            if existing_count >= MAX_IMAGES_PER_PRODUCT:
                raise serializers.ValidationError(
                    f"A product can have at most {MAX_IMAGES_PER_PRODUCT} images."
                )
        return attrs

    def create(self, validated_data):
        product = self.context['product']
        # If no images exist yet, make the first upload primary automatically
        if not ProductImage.objects.filter(product=product).exists():
            validated_data['is_primary'] = True
        return ProductImage.objects.create(product=product, **validated_data)


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'
        extra_kwargs = {
            'name': {'min_length': 2, 'max_length': 100},
            'description': {'max_length': 2000, 'required': False},
        }

    def get_average_rating(self, obj):
        # Use hasattr, not getattr(..., None): a product with no reviews has
        # avg_rating=None as a *valid annotated result* — None must not trigger
        # the fallback or every zero-review product fires an extra aggregate().
        if hasattr(obj, 'avg_rating'):
            avg = obj.avg_rating
        else:
            from django.db.models import Avg as _Avg
            avg = obj.reviews.aggregate(r=_Avg('rating'))['r']
        return round(avg, 1) if avg is not None else None

    def get_review_count(self, obj):
        if hasattr(obj, 'review_count'):
            return obj.review_count
        return obj.reviews.count()

    def get_images(self, obj):
        request = self.context.get('request')
        # Sort in Python to reuse the prefetch cache instead of issuing a new query
        images = sorted(obj.images.all(), key=lambda img: (not img.is_primary, img.uploaded_at))
        return [
            {
                'id': img.id,
                # Use the pre-cached CDN URL when available (Cloudinary/staging).
                # Fall back to building the URL for local-dev filesystem images.
                'image': img.cloudinary_url or _absolute_url(img.image.url, request),
                'is_primary': img.is_primary,
                'uploaded_at': img.uploaded_at,
            }
            for img in images
        ]

class StockMovementSerializer(serializers.ModelSerializer):
    created_by_email = serializers.ReadOnlyField(source='created_by.email')

    class Meta:
        model = StockMovement
        fields = ['id', 'product', 'change_type', 'quantity_change', 'stock_after', 'reason', 'created_by_email', 'created_at']
        read_only_fields = fields


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()
    reviewer_email = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ['id', 'product', 'reviewer_name', 'reviewer_email', 'rating', 'comment', 'created_at', 'updated_at', 'can_edit']
        read_only_fields = ['id', 'product', 'reviewer_name', 'reviewer_email', 'created_at', 'updated_at', 'can_edit']
        extra_kwargs = {
            'comment': {'max_length': 1000, 'required': False},
        }

    def get_reviewer_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.email

    def get_reviewer_email(self, obj):
        return obj.user.email

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if obj.user_id != request.user.pk:
            return False
        from config.models import SiteSettings
        from django.utils import timezone
        edit_days = SiteSettings.get().review_edit_days
        if edit_days == 0:
            return True
        cutoff = obj.created_at + timezone.timedelta(days=edit_days)
        return timezone.now() <= cutoff

    def validate(self, attrs):
        request = self.context['request']
        product = self.context['product']

        # On create, enforce verified buyer check
        if self.instance is None:
            has_delivered_order = Order.objects.filter(
                user=request.user,
                status__in=['Delivered', 'Return-Requested', 'Return-Approved'],
                items__product=product
            ).exists()
            if not has_delivered_order:
                raise serializers.ValidationError(
                    "You can only review products you have received."
                )
            if Review.objects.filter(user=request.user, product=product).exists():
                raise serializers.ValidationError(
                    "You have already reviewed this product."
                )

        return attrs

    def create(self, validated_data):
        return Review.objects.create(
            user=self.context['request'].user,
            product=self.context['product'],
            **validated_data
        )
