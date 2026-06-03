import csv
import functools
from decimal import Decimal, InvalidOperation

import django_filters
from rest_framework import viewsets, permissions, filters, generics, status
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Avg, Count, Q
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from ecommerce_backend.cache_utils import PublicCacheMixin
from ecommerce_backend.pagination import ProductPagination
from .models import Category, Product, ProductImage, Review, StockMovement
from .serializers import CategorySerializer, ProductSerializer, ProductImageSerializer, ReviewSerializer, StockMovementSerializer
from .stock_utils import record_stock_movement
from users.audit_utils import audit


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and request.user.role in ['admin', 'superadmin']


class CategoryViewSet(PublicCacheMixin, viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    # Categories are very stable — cache aggressively
    cache_max_age = 300
    cache_stale_while_revalidate = 600

    def get_queryset(self):
        user = self.request.user
        is_admin = user.is_authenticated and hasattr(user, 'role') and user.role in ('admin', 'superadmin')
        # Write operations must see all categories regardless of status
        if is_admin and self.request.method not in ('GET', 'HEAD', 'OPTIONS'):
            return Category.objects.all()
        show_all = is_admin and self.request.query_params.get('all') == 'true'
        if show_all:
            return Category.objects.all()
        return Category.objects.filter(status='active')


class ProductFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='price', lookup_expr='lte')
    in_stock   = django_filters.BooleanFilter(method='filter_in_stock')
    category   = django_filters.NumberFilter(field_name='category_id')

    class Meta:
        model = Product
        fields = ['category', 'min_price', 'max_price', 'in_stock']

    def filter_in_stock(self, queryset, name, value):
        if value:
            return queryset.filter(stock__gt=0)
        return queryset.filter(stock=0)


SORT_MAP = {
    'price_asc':   'price',
    'price_desc':  '-price',
    'newest':      '-id',
    'rating':      '-avg_rating',
    'popularity':  '-order_count',
}


class ProductViewSet(PublicCacheMixin, viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'description']
    filterset_class = ProductFilter
    pagination_class = ProductPagination
    # Products change more often than categories
    cache_max_age = 60
    cache_stale_while_revalidate = 300

    def get_object(self):
        obj = super().get_object()
        # Write-path queryset (fix 1.2) omits annotations for speed. Re-attach
        # them so the serialized response never triggers per-object fallbacks.
        if not hasattr(obj, 'avg_rating'):
            result = (
                Product.objects
                .filter(pk=obj.pk)
                .annotate(
                    avg_rating=Avg('reviews__rating'),
                    review_count=Count('reviews', distinct=True),
                )
                .values('avg_rating', 'review_count')
                .first()
            )
            obj.avg_rating = result['avg_rating']
            obj.review_count = result['review_count']
        return obj

    def perform_create(self, serializer):
        instance = serializer.save()
        audit(self.request.user, 'product_create', 'Product', instance.pk, f'Created product "{instance.name}"')

    def perform_update(self, serializer):
        instance = serializer.save()
        audit(self.request.user, 'product_update', 'Product', instance.pk, f'Updated product "{instance.name}"')

    def perform_destroy(self, instance):
        audit(self.request.user, 'product_delete', 'Product', instance.pk, f'Deleted product "{instance.name}"')
        instance.delete()

    def get_queryset(self):
        sort = self.request.query_params.get('sort', '')
        user = self.request.user
        is_admin = user.is_authenticated and hasattr(user, 'role') and user.role in ('admin', 'superadmin')

        # Write operations (create/update/delete): skip aggregation annotations entirely.
        # The serializer fallback handles avg_rating/review_count on those rare paths.
        if is_admin and self.request.method not in ('GET', 'HEAD', 'OPTIONS'):
            return (
                Product.objects
                .select_related('category')
                .prefetch_related('images')
                .order_by(SORT_MAP.get(sort, '-id'))
            )

        # Build all annotations in one pass → single GROUP BY in SQL.
        # order_count is only joined when actually sorting by popularity.
        annotations = {
            'avg_rating': Avg('reviews__rating'),
            'review_count': Count('reviews', distinct=True),
        }
        if sort == 'popularity':
            annotations['order_count'] = Count('orderitem', distinct=True)

        qs = (
            Product.objects
            .select_related('category')
            .prefetch_related('images')
            .annotate(**annotations)
        )

        show_all = is_admin and self.request.query_params.get('all') == 'true'
        if not show_all:
            qs = qs.filter(status='active', category__status='active')

        return qs.order_by(SORT_MAP.get(sort, '-id'))


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['admin', 'superadmin']


class ProductImageListCreateView(PublicCacheMixin, generics.ListCreateAPIView):
    serializer_class = ProductImageSerializer
    # Images are stable; 5 min is safe
    cache_max_age = 300
    cache_stale_while_revalidate = 600

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAdminUser()]

    @functools.cached_property
    def product(self):
        try:
            return Product.objects.get(pk=self.kwargs['product_pk'])
        except Product.DoesNotExist:
            raise NotFound("Product not found.")

    def get_queryset(self):
        return ProductImage.objects.filter(product=self.product).order_by('-is_primary', 'uploaded_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['product'] = self.product
        return context


class ProductImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductImageSerializer
    http_method_names = ['get', 'patch', 'delete']

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAdminUser()]

    @functools.cached_property
    def product(self):
        try:
            return Product.objects.get(pk=self.kwargs['product_pk'])
        except Product.DoesNotExist:
            raise NotFound("Product not found.")

    def get_object(self):
        try:
            return ProductImage.objects.get(pk=self.kwargs['pk'], product=self.product)
        except ProductImage.DoesNotExist:
            raise NotFound("Image not found.")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['product'] = self.product
        return context

    def perform_destroy(self, instance):
        was_primary = instance.is_primary
        instance.image.delete(save=False)
        instance.delete()
        # Auto-promote the oldest remaining image to primary if the deleted one was primary
        if was_primary:
            next_image = ProductImage.objects.filter(product_id=self.kwargs['product_pk']).order_by('uploaded_at').first()
            if next_image:
                next_image.is_primary = True
                next_image.save()


class ReviewListCreateView(PublicCacheMixin, generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    # Reviews change more frequently; keep TTL short
    cache_max_age = 30
    cache_stale_while_revalidate = 120

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    @functools.cached_property
    def product(self):
        try:
            return Product.objects.get(pk=self.kwargs['product_pk'])
        except Product.DoesNotExist:
            raise NotFound("Product not found.")

    def get_queryset(self):
        return Review.objects.filter(product=self.product).select_related('user').order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['product'] = self.product
        return context


class ReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch', 'put', 'delete']

    @functools.cached_property
    def product(self):
        try:
            return Product.objects.get(pk=self.kwargs['product_pk'])
        except Product.DoesNotExist:
            raise NotFound("Product not found.")

    def get_object(self):
        try:
            return Review.objects.select_related('user').get(
                pk=self.kwargs['pk'],
                product=self.product,
            )
        except Review.DoesNotExist:
            raise NotFound("Review not found.")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['product'] = self.product
        return context

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        is_admin = request.user.role in ['admin', 'superadmin']
        is_owner = obj.user == request.user
        if request.method in ('PUT', 'PATCH'):
            if not is_owner:
                raise PermissionDenied("You can only edit your own reviews.")
            self._check_edit_window(obj)
        if request.method == 'DELETE':
            if not (is_owner or is_admin):
                raise PermissionDenied("You do not have permission to delete this review.")
            if is_owner and not is_admin:
                self._check_edit_window(obj)

    def _check_edit_window(self, obj):
        from config.models import SiteSettings
        from django.utils import timezone
        edit_days = SiteSettings.get().review_edit_days
        if edit_days == 0:
            return
        cutoff = obj.created_at + timezone.timedelta(days=edit_days)
        if timezone.now() > cutoff:
            raise PermissionDenied(
                f"Reviews can only be edited within {edit_days} day{'s' if edit_days != 1 else ''} of submission."
            )


# ── Search Suggestions ───────────────────────────────────────────────────────

class ProductSuggestionsView(PublicCacheMixin, APIView):
    """
    Lightweight autocomplete endpoint.
    Returns up to 10 matching product id + name + price for a given query.
    """
    permission_classes = [permissions.AllowAny]
    cache_max_age = 30
    cache_stale_while_revalidate = 120

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response([])

        products = (
            Product.objects
            .filter(status='active', category__status='active')
            .filter(Q(name__icontains=q) | Q(description__icontains=q))
            .only('id', 'name', 'price', 'discount_percentage', 'stock')
            [:10]
        )

        return Response([
            {
                'id': p.id,
                'name': p.name,
                'price': str(p.price),
                'discount_percentage': str(p.discount_percentage),
                'in_stock': p.stock > 0,
            }
            for p in products
        ])


# ── Admin Bulk Operations ────────────────────────────────────────────────────

class AdminProductBulkUpdateView(APIView):
    """
    Bulk update price, stock, and/or discount_percentage on multiple products.
    At least one of the three fields must be provided.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    ALLOWED_FIELDS = {'price', 'stock', 'discount_percentage', 'status'}

    def post(self, request):
        product_ids = request.data.get('product_ids', [])
        if not product_ids or not isinstance(product_ids, list):
            return Response({'error': 'Provide a non-empty list of product_ids.'},
                            status=status.HTTP_400_BAD_REQUEST)

        updates = {k: v for k, v in request.data.items() if k in self.ALLOWED_FIELDS}
        if not updates:
            return Response(
                {'error': f"Provide at least one field to update: {', '.join(sorted(self.ALLOWED_FIELDS))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate values before touching the DB
        validated = {}
        errors = {}
        if 'price' in updates:
            try:
                val = Decimal(str(updates['price']))
                if val < 0:
                    errors['price'] = 'Must be >= 0.'
                else:
                    validated['price'] = val
            except InvalidOperation:
                errors['price'] = 'Invalid decimal value.'

        if 'stock' in updates:
            try:
                val = int(updates['stock'])
                if val < 0:
                    errors['stock'] = 'Must be >= 0.'
                else:
                    validated['stock'] = val
            except (TypeError, ValueError):
                errors['stock'] = 'Must be an integer.'

        if 'discount_percentage' in updates:
            try:
                val = Decimal(str(updates['discount_percentage']))
                if not (0 <= val <= 100):
                    errors['discount_percentage'] = 'Must be between 0 and 100.'
                else:
                    validated['discount_percentage'] = val
            except InvalidOperation:
                errors['discount_percentage'] = 'Invalid decimal value.'

        if 'status' in updates:
            val = updates['status']
            if val not in ('active', 'inactive'):
                errors['status'] = "Must be 'active' or 'inactive'."
            else:
                validated['status'] = val

        if errors:
            return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        products = Product.objects.filter(pk__in=product_ids)
        found_ids = set(products.values_list('id', flat=True))
        not_found_ids = [pid for pid in product_ids if pid not in found_ids]

        if 'stock' in validated:
            # Record a movement for each product individually when stock changes
            new_stock = validated['stock']
            non_stock = {k: v for k, v in validated.items() if k != 'stock'}
            for product in products:
                qty_change = new_stock - product.stock
                if qty_change != 0:
                    record_stock_movement(
                        product, 'bulk_update', qty_change,
                        reason='Bulk stock update by admin',
                        created_by=request.user,
                    )
                elif non_stock:
                    # stock unchanged but other fields need saving
                    for field, value in non_stock.items():
                        setattr(product, field, value)
                    product.save(update_fields=list(non_stock.keys()))
            if non_stock:
                products.update(**non_stock)
        else:
            products.update(**validated)

        updated_count = len(found_ids)
        if found_ids:
            audit(request.user, 'product_bulk_update', 'Product', None,
                  f'Bulk updated {list(validated.keys())} for product IDs: {list(found_ids)}')

        return Response({
            'updated': list(found_ids),
            'not_found': not_found_ids,
            'fields_updated': list(validated.keys()),
            'summary': f'{updated_count} products updated, {len(not_found_ids)} not found.',
        })


class AdminProductExportView(APIView):
    """Export full product catalog as CSV."""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        # Aggregate avg_rating and review_count in the queryset — single SQL query,
        # no per-row aggregate() or count() calls inside the loop.
        products = (
            Product.objects
            .select_related('category')
            .annotate(
                avg_r=Avg('reviews__rating'),
                rev_count=Count('reviews', distinct=True),
            )
            .order_by('category__name', 'name')
        )

        category_filter = request.query_params.get('category')
        if category_filter:
            products = products.filter(category_id=category_filter)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="products-export.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Product ID', 'Category', 'Category Status', 'Name', 'Description',
            'Price (BDT)', 'Discount %', 'Effective Price (BDT)',
            'Stock', 'Status', 'Avg Rating', 'Review Count',
        ])

        # iterator() streams rows from the DB cursor in chunks rather than
        # loading the entire result set into memory — safe for large catalogs.
        for product in products.iterator(chunk_size=500):
            effective_price = product.price * (1 - product.discount_percentage / 100)
            writer.writerow([
                product.id,
                product.category.name,
                product.category.status,
                product.name,
                product.description,
                product.price,
                product.discount_percentage,
                round(effective_price, 2),
                product.stock,
                product.status,
                round(product.avg_r, 1) if product.avg_r else '—',
                product.rev_count,
            ])

        return response


# ── Inventory Tracking ───────────────────────────────────────────────────────

class StockHistoryView(generics.ListAPIView):
    """Admin views stock movement history for a specific product."""
    serializer_class = StockMovementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        product_pk = self.kwargs['product_pk']
        if not Product.objects.filter(pk=product_pk).exists():
            raise NotFound("Product not found.")
        return StockMovement.objects.filter(product_id=product_pk).select_related('created_by').order_by('-created_at')


class StockAdjustView(APIView):
    """Admin manually adjusts stock for a product with a required reason."""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, product_pk):
        try:
            product = Product.objects.get(pk=product_pk)
        except Product.DoesNotExist:
            raise NotFound("Product not found.")

        quantity_change = request.data.get('quantity_change')
        reason = request.data.get('reason', '').strip()

        if quantity_change is None:
            return Response({'error': 'quantity_change is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity_change = int(quantity_change)
        except (TypeError, ValueError):
            return Response({'error': 'quantity_change must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        if quantity_change == 0:
            return Response({'error': 'quantity_change cannot be 0.'}, status=status.HTTP_400_BAD_REQUEST)

        if not reason:
            return Response({'error': 'reason is required for manual adjustments.'}, status=status.HTTP_400_BAD_REQUEST)

        new_stock = product.stock + quantity_change
        if new_stock < 0:
            return Response(
                {'error': f'Adjustment would result in negative stock ({new_stock}). Current stock: {product.stock}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        change_type = 'manual_add' if quantity_change > 0 else 'manual_remove'
        record_stock_movement(product, change_type, quantity_change, reason=reason, created_by=request.user)
        audit(request.user, 'stock_adjust', 'Product', product.pk,
              f'Manual stock adjustment {quantity_change:+d} for "{product.name}". Reason: {reason}')

        return Response({
            'product_id': product.id,
            'product_name': product.name,
            'quantity_change': quantity_change,
            'stock_after': product.stock,
            'reason': reason,
        }, status=status.HTTP_200_OK)
