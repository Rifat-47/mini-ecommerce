from django.utils.cache import patch_cache_control


class PublicCacheMixin:
    """
    Adds Cache-Control headers to GET/HEAD responses.

    - Unauthenticated requests → public, max_age / stale_while_revalidate
    - Authenticated requests   → private, no_store  (admin data must not be CDN-cached)
    - Non-200 or write methods → untouched

    Usage:
        class MyViewSet(PublicCacheMixin, viewsets.ReadOnlyModelViewSet):
            cache_max_age = 60
            cache_stale_while_revalidate = 300
    """

    cache_max_age: int = 60
    cache_stale_while_revalidate: int = 300

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if request.method not in ('GET', 'HEAD'):
            return response
        if response.status_code != 200:
            return response

        if request.user and request.user.is_authenticated:
            patch_cache_control(response, private=True, no_store=True)
        else:
            patch_cache_control(
                response,
                public=True,
                max_age=self.cache_max_age,
                stale_while_revalidate=self.cache_stale_while_revalidate,
            )
        return response
