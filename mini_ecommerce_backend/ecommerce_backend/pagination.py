from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """
    Global default — mirrors the previous PageNumberPagination behaviour but
    adds page_size_query_param so admin endpoints can request ?page_size=N.
    """
    page_size_query_param = 'page_size'
    max_page_size = 500


class ProductPagination(PageNumberPagination):
    """
    Customer-facing product list.
    12 items fits every grid breakpoint cleanly: xl(4×3), md(3×4), sm(2×6).
    """
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 48
