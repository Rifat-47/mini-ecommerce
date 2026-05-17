from django.urls import path
from .views import (
    InitiatePaymentView,
    PaymentCallbackView,
    VerifyPaymentView,
    OrderPaymentStatusView,
    AdminPaymentListView,
    AdminPaymentDetailView,
    CashOnDeliveryView,
)

urlpatterns = [
    path('payments/cod/', CashOnDeliveryView.as_view(), name='payment_cod'),
    path('payments/initiate/', InitiatePaymentView.as_view(), name='payment_initiate'),
    path('payments/callback/', PaymentCallbackView.as_view(), name='payment_callback'),
    path('payments/verify/<uuid:order_id>/', VerifyPaymentView.as_view(), name='payment_verify'),
    path('payments/order/<uuid:order_id>/', OrderPaymentStatusView.as_view(), name='payment_order_status'),
    path('admin/payments/', AdminPaymentListView.as_view(), name='admin_payment_list'),
    path('admin/payments/<int:pk>/', AdminPaymentDetailView.as_view(), name='admin_payment_detail'),
]
