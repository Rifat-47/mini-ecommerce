from rest_framework import viewsets, permissions, filters, generics
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from ecommerce_backend.email_utils import send_mail_async as _send_async
from django.db import models
from django.db.models import Sum, Count, F
import csv
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from django.conf import settings
from .pdf_utils import generate_invoice, generate_credit_note
from .models import Order, OrderItem, Coupon, ReturnRequest
from .stats_helpers import get_dashboard_stats
from notifications.utils import notify
from users.audit_utils import audit
from .serializers import (
    OrderSerializer, AdminOrderUpdateSerializer,
    CouponSerializer, CouponValidateSerializer,
    ReturnRequestSerializer, AdminReturnUpdateSerializer,
    STATUS_EMAIL_TEMPLATES,
)

User = get_user_model()


class IsAdminPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['admin', 'superadmin']


class OrderViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'user']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    lookup_field = 'public_id'
    lookup_value_regex = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Order.objects.none()
        qs = Order.objects.select_related('user', 'coupon').prefetch_related(
            'items__product__images',
        )
        if hasattr(user, 'role') and user.role in ['admin', 'superadmin']:
            return qs
        return qs.filter(user=user)

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            user = self.request.user
            if user.is_authenticated and hasattr(user, 'role') and user.role in ['admin', 'superadmin']:
                return AdminOrderUpdateSerializer
        return OrderSerializer

    def get_permissions(self):
        if self.action in ['update', 'partial_update']:
            return [permissions.IsAuthenticated(), IsAdminPermission()]
        return [permissions.IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Orders cannot be deleted. Use the cancel action instead."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        instance = serializer.save()
        if instance.status != old_status:
            audit(self.request.user, 'order_status_update', 'Order', instance.pk,
                  f'Status changed from "{old_status}" to "{instance.status}"')


class OrderCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, public_id):
        try:
            order = Order.objects.get(public_id=public_id, user=request.user)
        except Order.DoesNotExist:
            raise NotFound("Order not found.")

        if order.status != 'Pending':
            return Response(
                {"detail": f"Only Pending orders can be cancelled. This order is '{order.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.cancel()

        from config.models import SiteSettings
        cfg = SiteSettings.get()
        if cfg.email_notifications_enabled:
            _send_async(
                'Order Cancellation Confirmation',
                f'Your order #{order.id} has been successfully cancelled.\nYour stock has been restored.',
                cfg.from_email,
                [request.user.email],
            )
        notify(request.user, 'order_cancelled', f'Order #{order.id} Cancelled',
               f'Your order #{order.id} has been successfully cancelled.')

        return Response(
            {"message": f"Order #{order.id} has been cancelled successfully."},
            status=status.HTTP_200_OK,
        )


class AdminDashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminPermission]

    def get(self, request):
        top_n = self._parse_top(request.query_params.get('top', '5'))
        stats = get_dashboard_stats(top_n=top_n)
        ov = stats['overview']

        return Response({
            'overview': {
                'total_orders': ov['total_orders'],
                'total_revenue': str(ov['total_revenue']),
                'total_customers': ov['total_customers'],
                'new_users_today': ov['new_users_today'],
            },
            'orders_by_status': stats['orders_by_status'],
            'top_products': [
                {
                    'product_id': p['product__id'],
                    'product_name': p['product__name'],
                    'order_frequency': p['order_frequency'],
                    'units_sold': p['units_sold'],
                    'revenue': str(round(p['revenue'], 2)),
                }
                for p in stats['top_products']
            ],
        })

    def _parse_top(self, value):
        try:
            n = int(value)
            return max(1, min(n, 100))  # clamp between 1 and 100
        except (TypeError, ValueError):
            return 5


class AdminCouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all().order_by('-created_at')
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminPermission]

    def perform_create(self, serializer):
        instance = serializer.save()
        audit(self.request.user, 'coupon_create', 'Coupon', instance.pk, f'Created coupon "{instance.code}"')

    def perform_update(self, serializer):
        instance = serializer.save()
        audit(self.request.user, 'coupon_update', 'Coupon', instance.pk, f'Updated coupon "{instance.code}"')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        audit(self.request.user, 'coupon_delete', 'Coupon', instance.pk, f'Deleted coupon "{instance.code}"')
        self.perform_destroy(instance)
        return Response({"message": "Coupon deleted. Existing orders that used this coupon retain their discount."}, status=status.HTTP_200_OK)


class CouponValidateView(generics.GenericAPIView):
    serializer_class = CouponValidateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response({
            "code": data['coupon'].code,
            "discount_type": data['coupon'].discount_type,
            "discount_value": str(data['coupon'].discount_value),
            "discount_amount": str(data['discount_amount']),
            "final_total": str(data['final_total']),
        })


class PublicCouponListView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        user = request.user

        # Base: active, not expired, not exhausted
        coupons = Coupon.objects.filter(is_active=True).filter(
            models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gte=today)
        ).filter(
            models.Q(usage_limit__isnull=True) | models.Q(times_used__lt=models.F('usage_limit'))
        )

        # Personal coupons (user FK set) are only shown to the assigned user.
        coupons = coupons.filter(
            models.Q(user__isnull=True) | models.Q(user=user)
        )

        coupons = coupons.order_by('code')

        data = [
            {
                "code": c.code,
                "discount_type": c.discount_type,
                "discount_value": str(c.discount_value),
                "min_order_value": str(c.min_order_value) if c.min_order_value is not None else None,
                "expiry_date": str(c.expiry_date) if c.expiry_date else None,
            }
            for c in coupons
        ]
        return Response(data)


# ── Returns & Refunds ────────────────────────────────────────────────────────

class ReturnRequestView(APIView):
    """Customer initiates or views a return request for a delivered order."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, public_id):
        try:
            order = Order.objects.get(public_id=public_id, user=request.user)
        except Order.DoesNotExist:
            raise NotFound("Order not found.")

        if not hasattr(order, 'return_request'):
            return Response([])

        return Response(ReturnRequestSerializer(order.return_request).data)

    def post(self, request, public_id):
        try:
            order = Order.objects.get(public_id=public_id, user=request.user)
        except Order.DoesNotExist:
            raise NotFound("Order not found.")

        if order.status != 'Delivered':
            return Response(
                {'detail': f"Only Delivered orders can be returned. This order is '{order.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if hasattr(order, 'return_request'):
            return Response(
                {'detail': 'A return request already exists for this order.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Return window check
        from config.models import SiteSettings
        cfg_ret = SiteSettings.get()
        return_window = cfg_ret.return_window_days
        from django.utils import timezone as tz
        days_since_delivery = (tz.now() - order.created_at).days
        if days_since_delivery > return_window:
            return Response(
                {'detail': f'Return window has expired. Returns must be requested within {return_window} days of delivery.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'reason': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        return_request = ReturnRequest.objects.create(order=order, reason=reason)
        order.status = 'Return-Requested'
        order.save(update_fields=['status'])

        cfg_mail = SiteSettings.get()
        if cfg_mail.email_notifications_enabled:
            _send_async(
                f'Return Request Received — Order #{order.id}',
                (
                    f'Hi {order.user.first_name or order.user.email},\n\n'
                    f'We have received your return request for Order #{order.id}.\n'
                    f'Our team will review it and respond within 2 business days.\n\n'
                    f'Reason: {reason}\n\n'
                    f'— The {cfg_mail.store_name} Team'
                ),
                cfg_mail.from_email,
                [order.user.email],
            )
        notify(order.user, 'return_received', f'Return Request Received — Order #{order.id}',
               f'We have received your return request for Order #{order.id}. We will respond within 2 business days.')

        return Response(ReturnRequestSerializer(return_request).data, status=status.HTTP_201_CREATED)


class AdminReturnListView(generics.ListAPIView):
    """Admin lists all return requests with optional status filter."""
    permission_classes = [permissions.IsAuthenticated, IsAdminPermission]
    serializer_class = ReturnRequestSerializer

    def get_queryset(self):
        qs = ReturnRequest.objects.select_related('order', 'order__user').order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminReturnDetailView(generics.RetrieveUpdateAPIView):
    """Admin views or approves/rejects a return request."""
    permission_classes = [permissions.IsAuthenticated, IsAdminPermission]
    queryset = ReturnRequest.objects.select_related('order', 'order__user').all()

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return AdminReturnUpdateSerializer
        return ReturnRequestSerializer

    def perform_update(self, serializer):
        instance = serializer.save()
        audit(self.request.user, 'return_decision', 'ReturnRequest', instance.pk,
              f'Return {instance.status} for Order #{instance.order_id}')


class AdminRefundMarkView(APIView):
    """
    Admin marks a refund as complete after manually processing it
    through the ShurjoPay merchant portal.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminPermission]

    def post(self, request, pk):
        try:
            return_request = ReturnRequest.objects.select_related('order', 'order__user').get(pk=pk)
        except ReturnRequest.DoesNotExist:
            raise NotFound("Return request not found.")

        if return_request.status != 'approved':
            return Response(
                {'detail': 'Refund can only be marked for approved return requests.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if return_request.refund_status == 'completed':
            return Response({'detail': 'Refund is already marked as completed.'}, status=status.HTTP_400_BAD_REQUEST)

        return_request.refund_status = 'completed'
        return_request.save(update_fields=['refund_status'])

        order = return_request.order
        order.status = 'Returned'
        order.save(update_fields=['status'])

        if order.user:
            from config.models import SiteSettings
            cfg_rf = SiteSettings.get()
            if cfg_rf.email_notifications_enabled:
                _send_async(
                    f'Your Refund Has Been Processed — Order #{order.id}',
                    (
                        f'Hi {order.user.first_name or order.user.email},\n\n'
                        f'Your refund of BDT {order.total_amount:.2f} for Order #{order.id} has been processed.\n'
                        f'Please allow 3–7 business days for it to reflect in your account.\n\n'
                        f'— The {cfg_rf.store_name} Team'
                    ),
                    cfg_rf.from_email,
                    [order.user.email],
                )
            notify(order.user, 'refund_completed', f'Refund Processed — Order #{order.id}',
                   f'Your refund of BDT {order.total_amount:.2f} for Order #{order.id} has been processed.')
        audit(request.user, 'refund_marked', 'ReturnRequest', return_request.pk,
              f'Refund marked complete for Order #{order.id}')

        return Response(ReturnRequestSerializer(return_request).data)


# ── PDF Downloads ────────────────────────────────────────────────────────────

class InvoiceDownloadView(APIView):
    """Download invoice PDF for an order. Customer (own) or Admin."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, public_id):
        user = request.user
        is_admin = user.role in ('admin', 'superadmin')

        try:
            order = Order.objects.prefetch_related(
                'items__product__images', 'payment'
            ).get(public_id=public_id) if is_admin else Order.objects.prefetch_related(
                'items__product__images', 'payment'
            ).get(public_id=public_id, user=user)
        except Order.DoesNotExist:
            raise NotFound("Order not found.")

        buffer = generate_invoice(order)
        filename = f'invoice-{order.id:05d}.pdf'
        return FileResponse(buffer, as_attachment=True, filename=filename,
                            content_type='application/pdf')


class CreditNoteDownloadView(APIView):
    """Download credit note PDF for a completed refund. Customer (own) or Admin."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, public_id):
        user = request.user
        is_admin = user.role in ('admin', 'superadmin')

        try:
            order = Order.objects.prefetch_related(
                'items__product__images', 'return_request'
            ).get(public_id=public_id) if is_admin else Order.objects.prefetch_related(
                'items__product__images', 'return_request'
            ).get(public_id=public_id, user=user)
        except Order.DoesNotExist:
            raise NotFound("Order not found.")

        if not hasattr(order, 'return_request'):
            return Response({'detail': 'No return request found for this order.'},
                            status=status.HTTP_404_NOT_FOUND)

        return_request = order.return_request
        if return_request.refund_status != 'completed':
            return Response(
                {'detail': 'Credit note is only available after the refund has been completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        buffer = generate_credit_note(return_request)
        filename = f'credit-note-CN{return_request.id:05d}.pdf'
        return FileResponse(buffer, as_attachment=True, filename=filename,
                            content_type='application/pdf')


# ── Admin Bulk Operations ────────────────────────────────────────────────────

BULK_ALLOWED_STATUSES = {'Pending', 'In-Progress', 'Delivered', 'Cancelled'}


class AdminOrderBulkUpdateView(APIView):
    """Bulk update status on multiple orders at once."""
    permission_classes = [permissions.IsAuthenticated, IsAdminPermission]

    def post(self, request):
        order_ids = request.data.get('order_ids', [])
        new_status = request.data.get('status', '').strip()

        if not order_ids or not isinstance(order_ids, list):
            return Response({'error': 'Provide a non-empty list of order_ids.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if new_status not in BULK_ALLOWED_STATUSES:
            return Response(
                {'error': f"Invalid status. Allowed values: {', '.join(sorted(BULK_ALLOWED_STATUSES))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        orders = Order.objects.filter(pk__in=order_ids)
        found_ids = set(orders.values_list('id', flat=True))
        not_found_ids = [oid for oid in order_ids if oid not in found_ids]

        updated, skipped = [], []
        for order in orders:
            if order.status == new_status:
                skipped.append({'id': order.id, 'reason': 'Already at this status.'})
                continue
            if new_status == 'Cancelled':
                order.cancel()
            else:
                order.status = new_status
                order.save(update_fields=['status'])

            # Send status-change email if template exists
            if new_status in STATUS_EMAIL_TEMPLATES and order.user:
                from config.models import SiteSettings
                cfg_bulk = SiteSettings.get()
                if cfg_bulk.email_notifications_enabled:
                    template = STATUS_EMAIL_TEMPLATES[new_status]
                    _send_async(
                        template['subject'].format(order_id=order.id),
                        template['body'].format(
                            name=order.user.first_name or order.user.email,
                            order_id=order.id,
                            total=order.total_amount,
                            store_name=cfg_bulk.store_name,
                        ),
                        cfg_bulk.from_email,
                        [order.user.email],
                    )
            if order.user:
                notify(order.user, 'order_status', f'Order #{order.id} — {new_status}',
                       f'Your order #{order.id} status has been updated to "{new_status}".')
            updated.append(order.id)

        if updated:
            audit(request.user, 'order_bulk_update', 'Order', None,
                  f'Bulk status → "{new_status}" for order IDs: {updated}')

        return Response({
            'updated': updated,
            'skipped': skipped,
            'not_found': not_found_ids,
            'summary': f'{len(updated)} updated, {len(skipped)} skipped, {len(not_found_ids)} not found.',
        })


class AdminOrderExportView(APIView):
    """Export orders as CSV. Supports ?status= filter."""
    permission_classes = [permissions.IsAuthenticated, IsAdminPermission]

    def get(self, request):
        orders = Order.objects.select_related(
            'user', 'coupon', 'payment'
        ).prefetch_related('items__product').order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            orders = orders.filter(status=status_filter)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="orders-export.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Order ID', 'Customer Email', 'Customer Name',
            'Status', 'Total Amount (BDT)', 'Discount Amount (BDT)',
            'Coupon Code', 'Payment Status', 'Payment Method',
            'Transaction ID', 'Shipping Address', 'Items', 'Created At',
        ])

        for order in orders:
            items_str = ' | '.join(
                f"{item.product.name} x{item.quantity}"
                for item in order.items.all()
            )
            payment = getattr(order, 'payment', None)
            writer.writerow([
                order.id,
                order.user.email if order.user else '[deleted user]',
                order.user.get_full_name() if order.user else '—',
                order.status,
                order.total_amount,
                order.discount_amount,
                order.coupon.code if order.coupon else '—',
                payment.status if payment else '—',
                payment.payment_method if payment else '—',
                payment.transaction_id if payment else '—',
                order.shipping_address,
                items_str,
                order.created_at.strftime('%Y-%m-%d %H:%M'),
            ])

        return response
