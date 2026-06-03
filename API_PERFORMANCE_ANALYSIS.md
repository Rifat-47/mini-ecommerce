# API Performance Analysis & Optimisation Plan

> Generated: 2026-06-03  
> Branch: `staging`  
> Scope: All DRF endpoints across `catalog`, `orders`, `cart`, `users`, `notifications`, `config`

---

## Executive Summary

The products list API (`GET /api/products/`) is the highest-traffic endpoint and the biggest
performance bottleneck — currently taking **6 s+** on staging. The root cause is a combination
of **missing database indexes**, **N+1 queries hidden inside serializers**, **no HTTP caching**,
**no server-side response cache**, and **Cloudinary image URLs being built on every request
without any CDN transformation hints**.

The fixes below are grouped by impact tier. Tier 1 alone should bring the products API below
**300 ms**. All tiers together should bring it under **100 ms** for cached responses.

---

## Tier 1 — Critical (fix first, biggest wins)

### 1.1 Missing DB indexes

**Problem:** Several columns that are filtered, sorted, or joined on every products query have no
index. PostgreSQL does a full sequential scan on 30+ products today; at 1 000+ products this
becomes catastrophically slow.

| Table | Column | Usage | Index needed |
|---|---|---|---|
| `catalog_product` | `status` | `filter(status='active')` on every list | `db_index=True` ✅ already |
| `catalog_product` | `category_id` | JOIN + filter `category__status='active'` | needs composite |
| `catalog_category` | `status` | filter in every product query | `db_index=True` missing |
| `catalog_review` | `product_id` | aggregated on every product row | FK index (auto) ✅ |
| `catalog_productimage` | `product_id, is_primary` | sorted per product | composite missing |
| `orders_orderitem` | `product_id` | `Count('orderitem')` for popularity sort | FK index (auto) ✅ |
| `users_user` | `email` | login lookup | unique ✅ |

**Fix:** Add a new migration:

```python
# catalog/migrations/0010_add_performance_indexes.py
operations = [
    migrations.AddIndex(
        model_name='category',
        index=models.Index(fields=['status'], name='catalog_category_status_idx'),
    ),
    migrations.AddIndex(
        model_name='product',
        index=models.Index(fields=['status', 'category_id'], name='catalog_product_status_cat_idx'),
    ),
    migrations.AddIndex(
        model_name='productimage',
        index=models.Index(fields=['product', 'is_primary'], name='catalog_productimage_product_primary_idx'),
    ),
    migrations.AddIndex(
        model_name='review',
        index=models.Index(fields=['product'], name='catalog_review_product_idx'),
    ),
]
```

**Expected gain:** 60–80 % query time reduction at scale.

---

### 1.2 Double annotation / redundant `order_count` annotation

**Problem** (`catalog/views.py:90–105`):

```python
# Always annotated — even when sort != 'popularity'
qs = Product.objects.annotate(
    avg_rating=Avg('reviews__rating'),
    review_count=Count('reviews', distinct=True),
)
# Then AGAIN for popularity
if sort == 'popularity':
    qs = qs.annotate(order_count=Count('orderitem', distinct=True))
```

The `Avg + Count` annotations force a GROUP BY with two expensive sub-aggregations on every
single products request — even simple paginated list pages that never display ratings.

**Fix:** Move annotations to be conditional, and combine into one `.annotate()` call when needed:

```python
def get_queryset(self):
    sort = self.request.query_params.get('sort', '')
    ...
    annotations = {
        'avg_rating': Avg('reviews__rating'),
        'review_count': Count('reviews', distinct=True),
    }
    if sort == 'popularity':
        annotations['order_count'] = Count('orderitem', distinct=True)
    
    qs = Product.objects.select_related('category') \
                        .prefetch_related('images') \
                        .annotate(**annotations)
    ...
```

**Expected gain:** 40–60 % on non-popularity sorted requests.

---

### 1.3 Serializer fallback queries (N+1 hidden in Python)

**Problem** (`catalog/serializers.py:64–75`):

```python
def get_average_rating(self, obj):
    avg = getattr(obj, 'avg_rating', None)
    if avg is None:                          # ← fires a query per product
        avg = obj.reviews.aggregate(...)['r']

def get_review_count(self, obj):
    count = getattr(obj, 'review_count', None)
    if count is None:                        # ← fires a query per product
        count = obj.reviews.count()
```

If `avg_rating` / `review_count` are ever missing from the queryset (e.g. when a single product
is retrieved via `ProductViewSet.retrieve()` without the list annotation), these fallbacks issue
**one query per product**. For 30 products = 60 extra queries.

**Fix:** Ensure `retrieve()` also annotates, or override `get_object()`:

```python
def get_object(self):
    pk = self.kwargs['pk']
    return Product.objects.select_related('category') \
        .prefetch_related('images') \
        .annotate(
            avg_rating=Avg('reviews__rating'),
            review_count=Count('reviews', distinct=True),
        ).get(pk=pk)
```

---

### 1.4 Cloudinary URL resolution on every request

**Problem** (`catalog/serializers.py:84`):

```python
'image': _absolute_url(img.image.url, request),
```

`img.image.url` calls `cloudinary.CloudinaryImage(public_id).build_url()` synchronously for
**every image on every product on every request**. With 4 images × 30 products = 120 URL
constructions per list call. This is pure Python CPU work that can be cached.

**Fix — short term:** Cache the URL on the model instance in memory (no DB change needed):

```python
# In CloudinaryMediaStorage.url():
# Cache in the instance so repeated calls within a request are free
```

**Fix — medium term:** Store the final CDN URL as a `CharField` on `ProductImage` so no
computation is needed at serialization time. Add a `cloudinary_url` field and populate it on
save. This is the cleanest solution.

---

## Tier 2 — High Impact

### 2.1 No pagination on admin product export CSV

**Problem** (`catalog/views.py:394–430`): `AdminProductExportView` loads every product + all
reviews into memory and then calls `product.reviews.aggregate(...)` **inside the loop** — one
aggregate query per product row.

```python
for product in products:
    avg = product.reviews.aggregate(Avg('rating'))['rating__avg']  # N queries!
    ...
    product.reviews.count()   # another N queries!
```

With 1 000 products = 2 000 extra queries just for the CSV export.

**Fix:** Push the aggregation into the queryset:

```python
from django.db.models import Avg, Count

products = Product.objects.select_related('category') \
    .annotate(avg_r=Avg('reviews__rating'), rev_count=Count('reviews')) \
    .order_by('category__name', 'name')

for product in products:
    avg = product.avg_r
    count = product.rev_count
```

---

### 2.2 `get_product()` called twice per request in image/review views

**Problem** (`catalog/views.py:121–133` and `145–160`):

```python
def get_queryset(self):
    return ProductImage.objects.filter(product=self.get_product())  # query 1

def get_serializer_context(self):
    context['product'] = self.get_product()                          # query 2
```

`get_product()` hits the DB each time. For list+create views this is **2 DB hits just to find the
parent product**.

**Fix:** Cache on the view instance:

```python
@functools.cached_property
def product(self):
    try:
        return Product.objects.get(pk=self.kwargs['product_pk'])
    except Product.DoesNotExist:
        raise NotFound("Product not found.")
```

---

### 2.3 `cart/views.py:86` — double queryset evaluation

**Problem:**

```python
def list(self, request, *args, **kwargs):
    queryset = self.get_queryset()
    serializer = self.get_serializer(queryset, many=True)
    cart_total = sum(item['line_total'] for item in serializer.data)
    return Response({
        ...
        "item_count": queryset.count(),   # ← hits DB again
    })
```

`queryset.count()` fires a second `SELECT COUNT(*)` after the queryset was already fully
evaluated.

**Fix:**

```python
"item_count": len(serializer.data)
```

---

### 2.4 `SiteSettings.get()` called on every review serialize

**Problem** (`catalog/serializers.py:126–131`): `get_can_edit()` is called for every review in
a list. Each call does:

```python
edit_days = SiteSettings.get().review_edit_days
```

If `SiteSettings.get()` does a DB query (even with `get_or_create`), a 20-review page = 20
extra queries.

**Fix:** Use `django.core.cache` to cache site settings for 60 seconds, or pass `edit_days` via
serializer context from the view once.

---

### 2.5 No HTTP caching headers on public read endpoints

**Problem:** `GET /api/products/`, `GET /api/products/{id}/`, and `GET /api/categories/` are
fully public, read-only, and change infrequently. They currently return no `Cache-Control`
headers, so every browser and CDN re-fetches them on every page load.

**Fix:** Add `Cache-Control: public, max-age=60, stale-while-revalidate=300` to public catalog
responses. Implement using a DRF custom renderer or a simple middleware / decorator.

With Netlify CDN in front, this alone can eliminate **100 % of origin hits** for repeat visitors.

---

## Tier 3 — Medium Impact

### 3.1 Server-side response caching (Redis)

**Problem:** No server-side cache. Every request recalculates the same product list.

**Recommendation:** Add `django-redis` and cache the products list queryset result:

```python
# In ProductViewSet.list():
from django.core.cache import cache

cache_key = f"products:{request.query_params.urlencode()}"
cached = cache.get(cache_key)
if cached:
    return Response(cached)
# ... build response ...
cache.set(cache_key, response.data, timeout=60)
```

Invalidate on any product/category save/delete signal.

Render supports Redis as a paid add-on. For free-tier staging, use Upstash Redis (serverless, free tier available).

---

### 3.2 `search_fields` uses `icontains` — slow on large datasets

**Problem:** `search_fields = ['name', 'description']` generates `ILIKE '%query%'` which cannot
use a B-tree index.

**Recommendation:** Add a PostgreSQL `GIN` index with `pg_trgm` trigram extension for fast
full-text search:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX catalog_product_name_trgm_idx ON catalog_product USING GIN (name gin_trgm_ops);
CREATE INDEX catalog_product_desc_trgm_idx ON catalog_product USING GIN (description gin_trgm_ops);
```

Or use Django's `SearchVector` with a `GinIndex` via a migration. Either way this converts
O(n) full table scans to O(log n) index lookups.

---

### 3.3 Pagination page size

**Problem:** `PAGE_SIZE = 20` is set globally but the product list fetches annotations for all 20
rows plus their related images simultaneously. The front-end may be requesting all pages.

**Recommendation:** Reduce to 12 for product lists (matches typical grid layouts). Add a
`ProductPagination` class overriding `page_size = 12` and `max_page_size = 50`.

---

### 3.4 `conn_max_age` and connection pooling

**Problem** (`settings/base.py:74`): `conn_max_age=600` is set but Render/Gunicorn workers
each maintain their own connection pool. With 4 Gunicorn workers, this creates up to 4 persistent
connections which is fine — but Neon (serverless Postgres) has a connection limit and cold starts.

**Recommendation:** Add `PgBouncer` or use Neon's built-in connection pooling endpoint
(append `?pgbouncer=true` or use the pooled connection string). This is especially important
when traffic spikes.

---

## Tier 4 — Infrastructure / Frontend

### 4.1 Cloudinary image transformations

Currently images are served at full resolution. A product card only needs a 400×400 thumbnail.

**Fix:** Use Cloudinary's transformation URLs:

```python
# In CloudinaryMediaStorage.url():
def thumbnail_url(self, name, width=400, height=400):
    public_id = name.replace('\\', '/').rsplit('.', 1)[0]
    return cloudinary.CloudinaryImage(public_id).build_url(
        width=width, height=height, crop='fill', quality='auto', fetch_format='auto'
    )
```

Return both `image` (full) and `thumbnail` in `ProductImageSerializer`. Frontend uses thumbnail
in listings, full in product detail. This reduces image payload by **80–90 %**.

---

### 4.2 Frontend — no stale-while-revalidate / optimistic caching

The React frontend (Vite) likely fetches `/api/products/` on every mount with no local cache.

**Recommendation:** Use **TanStack Query** (`@tanstack/react-query`) with:
- `staleTime: 60_000` — treat data as fresh for 60 s
- `gcTime: 5 * 60_000` — keep in memory for 5 min

This eliminates repeat API calls during navigation within the same session.

---

### 4.3 Gunicorn worker configuration

**Current** (`railway.toml`): `--workers 4`

With 4 sync workers and a 6 s DB query, all workers can be blocked simultaneously under modest
traffic. 

**Recommendation:** Switch to `gevent` async workers or `uvicorn` ASGI:

```
gunicorn ecommerce_backend.wsgi:application \
  --workers 2 \
  --worker-class gevent \
  --worker-connections 100 \
  --bind 0.0.0.0:$PORT
```

Or migrate to ASGI (`ecommerce_backend.asgi:application`) with `uvicorn` for full async support.

---

## Summary Checklist (priority order)

| # | Fix | File(s) | Effort | Expected Gain |
|---|-----|---------|--------|---------------|
| 1 | ~~Add DB indexes (status, composite)~~ ✅ Done — migration `0010` applied to local + staging | new migration | S | 60–80 % |
| 2 | ~~Conditional annotations (skip when not sorting by rating/popularity)~~ ✅ Done — single `.annotate()` dict; write ops skip GROUP BY entirely | `catalog/views.py` | S | 40–60 % |
| 3 | ~~Fix N+1 in serializer fallbacks~~ ✅ Done — `hasattr` guard in serializer; `get_object()` override enriches write-path objects | `catalog/serializers.py`, `views.py` | S | 30–50 % |
| 4 | ~~Fix CSV export N+1 (`aggregate` in loop)~~ ✅ Done — annotations in queryset + `iterator(chunk_size=500)` | `catalog/views.py` | S | Admin only |
| 5 | ~~Cache `get_product()` on view instance~~ ✅ Done — `@functools.cached_property` on all 4 views; `get_product()` method removed | `catalog/views.py` | S | 1–2 queries/req |
| 6 | ~~Fix cart `queryset.count()` double eval~~ ✅ Done — `len(serializer.data)` replaces `queryset.count()` | `cart/views.py` | XS | Minor |
| 7 | ~~Cache `SiteSettings.get()`~~ ✅ Done — 60 s TTL via Django cache; invalidated on `save()`; fixes all 28 call sites | `config/models.py` | S | 20 queries/page |
| 8 | ~~Add HTTP `Cache-Control` headers~~ ✅ Done — `PublicCacheMixin` on 5 views; anon→public, auth→private/no-store | middleware / view | M | Eliminates CDN misses |
| 9 | ~~Store Cloudinary URL as CharField~~ ✅ Done — `cloudinary_url` URLField on `ProductImage`; backfilled 110 staging records; cart/order N+1 fixed too | `catalog/models.py` + migration | M | 120 URL constructions/req |
| 10 | Cloudinary thumbnail transformations | `storage.py`, serializer | M | 80–90 % image payload |
| 11 | Redis server-side cache for product list | `catalog/views.py`, settings | M | 100 % for cached pages |
| 12 | ~~pg_trgm trigram indexes for search~~ ✅ Done — migration `0012`; GIN indexes on `name` + `description`; both DBs updated | migration + SQL | M | O(log n) search |
| 3.3 | ~~Pagination page size~~ ✅ Done — `ProductPagination(12)`, `DefaultPagination` with `page_size_query_param`; frontend `pageSize={12}` on product list | `pagination.py`, `views.py`, `ProductListPage.jsx` | S | 40% fewer rows/request |
| 13 | TanStack Query on frontend | frontend | M | Eliminates repeat fetches |
| 14 | ~~`conn_health_checks` + Gunicorn tuning~~ ✅ Done — `conn_health_checks=True` on DATABASE_URL path; `gunicorn.conf.py` with 2 workers/120 s timeout; Neon pooler documented in STAGING_DEPLOYMENT.md | `settings/base.py`, `gunicorn.conf.py` | XS | Stability under load |
| 15 | Gunicorn gevent workers | `railway.toml` | XS | Concurrency under load |

> **XS** = < 30 min · **S** = < 2 hrs · **M** = half day

---

## Immediate Next Steps (recommended order)

1. **Run migration** with new indexes → deploy → measure.
2. **Fix `get_queryset` annotations** (conditional) + serializer fallback guard.
3. **Fix CSV export loop** + `get_product()` caching.
4. **Add `Cache-Control` headers** on public catalog endpoints.
5. **Add Cloudinary thumbnail URL** field to `ProductImage` + update serializer.
6. **Add Redis + product list cache** (Upstash free tier on Render staging).
7. **Integrate TanStack Query** on frontend.

Each step is independently deployable and measurable.
