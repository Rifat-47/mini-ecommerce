from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrderViewSet, AdminCouponViewSet, CouponValidateView, PublicCouponListView,
    OrderCancelView, AdminDashboardStatsView,
    ReturnRequestView, AdminReturnListView, AdminReturnDetailView, AdminRefundMarkView,
    InvoiceDownloadView, CreditNoteDownloadView,
    AdminOrderBulkUpdateView, AdminOrderExportView,
)

order_router = DefaultRouter()
order_router.register(r'', OrderViewSet, basename='order')

coupon_router = DefaultRouter()
coupon_router.register(r'', AdminCouponViewSet, basename='coupon')

urlpatterns = [
    path('orders/', include(order_router.urls)),
    path('orders/<uuid:public_id>/cancel/', OrderCancelView.as_view(), name='order-cancel'),

    # Returns (customer)
    path('orders/<uuid:public_id>/return/', ReturnRequestView.as_view(), name='order-return'),

    # Returns (admin — internal, keep integer pk)
    path('admin/returns/', AdminReturnListView.as_view(), name='admin-return-list'),
    path('admin/returns/<int:pk>/', AdminReturnDetailView.as_view(), name='admin-return-detail'),
    path('admin/returns/<int:pk>/refund/', AdminRefundMarkView.as_view(), name='admin-return-refund'),

    # PDF downloads (public_id — shared by customer and admin)
    path('orders/<uuid:public_id>/invoice/', InvoiceDownloadView.as_view(), name='order-invoice'),
    path('orders/<uuid:public_id>/credit-note/', CreditNoteDownloadView.as_view(), name='order-credit-note'),

    # Bulk operations (admin)
    path('admin/orders/bulk-update/', AdminOrderBulkUpdateView.as_view(), name='admin-order-bulk-update'),
    path('admin/orders/export/', AdminOrderExportView.as_view(), name='admin-order-export'),

    path('admin/coupons/', include(coupon_router.urls)),
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin-stats'),
    path('coupons/', PublicCouponListView.as_view(), name='coupon-list'),
    path('coupons/validate/', CouponValidateView.as_view(), name='coupon-validate'),
]
