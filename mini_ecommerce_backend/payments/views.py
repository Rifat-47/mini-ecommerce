from django.conf import settings
from ecommerce_backend.email_utils import send_mail_async as _send_async
from ecommerce_backend.email_utils import send_mail_with_pdf_async as _send_with_pdf
from django.shortcuts import redirect
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import Order
from .models import Payment
from .serializers import PaymentSerializer, AdminPaymentUpdateSerializer
from .services import ShurjopayError, create_payment, verify_payment
from notifications.utils import notify


class InitiatePaymentView(APIView):
    """Customer initiates payment for a Pending order."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from config.models import SiteSettings
        if not SiteSettings.get().online_payment_enabled:
            return Response({'error': 'Online payment is currently unavailable.'}, status=status.HTTP_400_BAD_REQUEST)

        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'error': 'order_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.get(public_id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'Pending':
            return Response(
                {'error': f'Payment can only be initiated for Pending orders. This order is {order.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Return existing checkout URL if payment already initiated
        if hasattr(order, 'payment') and order.payment.status == 'pending' and order.payment.checkout_url:
            return Response({
                'checkout_url': order.payment.checkout_url,
                'payment_id': order.payment.id,
                'message': 'Payment already initiated. Use the checkout URL to complete payment.',
            })

        client_ip = (
            request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            or request.META.get('REMOTE_ADDR', '127.0.0.1')
        )

        try:
            result = create_payment(order, request.user, client_ip)
        except ShurjopayError as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        payment, _ = Payment.objects.update_or_create(
            order=order,
            defaults={
                'shurjopay_order_id': result['shurjopay_order_id'],
                'amount': order.total_amount,
                'status': 'pending',
                'checkout_url': result['checkout_url'],
                'sp_code': result['sp_code'],
                'sp_message': result['sp_message'],
            },
        )

        return Response({
            'checkout_url': payment.checkout_url,
            'payment_id': payment.id,
            'amount': str(payment.amount),
            'currency': payment.currency,
        }, status=status.HTTP_201_CREATED)


class PaymentCallbackView(APIView):
    """
    ShurjoPay redirects the customer here after payment (success or failure).
    Verifies the payment and redirects to the frontend.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        sp_order_id = request.query_params.get('order_id')
        if not sp_order_id:
            return redirect(f"{settings.FRONTEND_URL}/payment/failed?reason=missing_order_id")

        try:
            payment = Payment.objects.select_related('order').get(shurjopay_order_id=sp_order_id)
        except Payment.DoesNotExist:
            return redirect(f"{settings.FRONTEND_URL}/payment/failed?reason=payment_not_found")

        # Already processed — avoid double processing
        if payment.status in ('completed', 'failed', 'cancelled'):
            return redirect(self._redirect_url(payment))

        try:
            verification = verify_payment(sp_order_id)
        except ShurjopayError:
            return redirect(f"{settings.FRONTEND_URL}/payment/failed?order_id={payment.order_id}")

        self._update_payment(payment, verification)
        return redirect(self._redirect_url(payment))

    def _update_payment(self, payment, data):
        bank_status = data.get('bank_status', '').lower()
        sp_code = str(data.get('sp_code', ''))

        # Set all fields before saving so generate_invoice reads correct DB state.
        payment.transaction_id = data.get('bank_trx_id', '')
        payment.payment_method = data.get('method', '')
        payment.sp_code = sp_code
        payment.sp_message = data.get('sp_message', '')

        if bank_status == 'success' or sp_code == '1000':
            payment.status = 'completed'
            payment.order.status = 'In-Progress'
            payment.order.save(update_fields=['status'])
        elif bank_status in ('cancel', 'cancelled'):
            payment.status = 'cancelled'
        else:
            payment.status = 'failed'

        payment.save()

        if payment.status == 'completed':
            self._send_payment_confirmation(payment)
            notify(payment.order.user, 'payment_success',
                   f'Payment Confirmed — Order #{payment.order_id}',
                   f'Your payment of BDT {payment.amount:.2f} for Order #{payment.order_id} was successful.')
        elif payment.status == 'failed':
            self._send_payment_failure(payment)
            notify(payment.order.user, 'payment_failed',
                   f'Payment Failed — Order #{payment.order_id}',
                   f'Your payment for Order #{payment.order_id} could not be completed. Please try again.')

    def _send_payment_confirmation(self, payment):
        order = payment.order
        if not order.user:
            return
        from config.models import SiteSettings
        cfg = SiteSettings.get()
        if not cfg.email_notifications_enabled:
            return
        from orders.models import Order as _Order
        from orders.pdf_utils import generate_invoice
        full_order = _Order.objects.prefetch_related('items__product', 'payment').get(pk=order.pk)
        pdf = generate_invoice(full_order)
        _send_with_pdf(
            f'Payment Confirmed — Order #{order.id}',
            (
                f'Hi {order.user.first_name or order.user.email},\n\n'
                f'Your payment of BDT {payment.amount:.2f} for Order #{order.id} has been received.\n'
                f'Your order is now being processed.\n\n'
                f'Transaction ID: {payment.transaction_id}\n'
                f'Payment Method: {payment.payment_method}\n\n'
                f'Please find your invoice attached.\n\n'
                f'— The {cfg.store_name} Team'
            ),
            cfg.from_email,
            [order.user.email],
            pdf,
            f'invoice-{order.id:05d}.pdf',
        )

    def _send_payment_failure(self, payment):
        order = payment.order
        if not order.user:
            return
        from config.models import SiteSettings
        cfg = SiteSettings.get()
        if not cfg.email_notifications_enabled:
            return
        from orders.models import Order as _Order
        from orders.pdf_utils import generate_invoice
        full_order = _Order.objects.prefetch_related('items__product', 'payment').get(pk=order.pk)
        pdf = generate_invoice(full_order)
        _send_with_pdf(
            f'Payment Failed — Order #{order.id}',
            (
                f'Hi {order.user.first_name or order.user.email},\n\n'
                f'Unfortunately, your payment for Order #{order.id} could not be completed.\n\n'
                f'Your order is still saved and you can retry payment or switch to '
                f'Cash on Delivery from your order history.\n\n'
                f'Please find your invoice attached for reference.\n\n'
                f'— The {cfg.store_name} Team'
            ),
            cfg.from_email,
            [order.user.email],
            pdf,
            f'invoice-{order.id:05d}.pdf',
        )

    def _redirect_url(self, payment):
        base = settings.FRONTEND_URL
        public_id = payment.order.public_id
        if payment.status == 'completed':
            return f'{base}/payment/success?order_id={public_id}'
        if payment.status == 'cancelled':
            return f'{base}/payment/cancelled?order_id={public_id}'
        return f'{base}/payment/failed?order_id={public_id}'


class VerifyPaymentView(APIView):
    """Manually re-verify a payment. Useful if the callback was missed."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(public_id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not hasattr(order, 'payment'):
            return Response({'error': 'No payment initiated for this order.'}, status=status.HTTP_404_NOT_FOUND)

        payment = order.payment
        if payment.status == 'completed':
            return Response(PaymentSerializer(payment).data)

        try:
            verification = verify_payment(payment.shurjopay_order_id)
        except ShurjopayError as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        callback_view = PaymentCallbackView()
        callback_view._update_payment(payment, verification)

        return Response(PaymentSerializer(payment).data)


class OrderPaymentStatusView(APIView):
    """Get payment status for a specific order."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, order_id):
        try:
            order = Order.objects.get(public_id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not hasattr(order, 'payment'):
            return Response({'error': 'No payment initiated for this order.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PaymentSerializer(order.payment).data)


class CashOnDeliveryView(APIView):
    """Customer selects Cash on Delivery — no payment gateway involved."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from config.models import SiteSettings
        cfg = SiteSettings.get()
        if not cfg.cod_enabled:
            return Response({'error': 'Cash on Delivery is currently unavailable.'}, status=status.HTTP_400_BAD_REQUEST)

        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'error': 'order_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.get(public_id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'Pending':
            return Response(
                {'error': f'COD can only be selected for Pending orders. This order is {order.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cfg.cod_min_order_value and order.total_amount < cfg.cod_min_order_value:
            return Response(
                {'error': f'Minimum order value of {cfg.currency} {cfg.cod_min_order_value} is required for Cash on Delivery.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if hasattr(order, 'payment'):
            return Response(
                {'error': 'A payment record already exists for this order.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Payment.objects.create(
            order=order,
            amount=order.total_amount,
            payment_method='cash_on_delivery',
            status='pending',
        )

        order.status = 'In-Progress'
        order.save(update_fields=['status'])

        if order.user and cfg.email_notifications_enabled:
            from orders.models import Order as _Order
            from orders.pdf_utils import generate_invoice
            full_order = _Order.objects.prefetch_related('items__product', 'payment').get(pk=order.pk)
            pdf = generate_invoice(full_order)
            _send_with_pdf(
                f'Order Confirmed (Cash on Delivery) — #{order.id}',
                (
                    f'Hi {order.user.first_name or order.user.email},\n\n'
                    f'Your order #{order.id} has been confirmed with Cash on Delivery.\n'
                    f'Total amount due on delivery: {cfg.currency} {order.total_amount:.2f}\n\n'
                    f'Please find your invoice attached.\n\n'
                    f'— The {cfg.store_name} Team'
                ),
                cfg.from_email,
                [order.user.email],
                pdf,
                f'invoice-{order.id:05d}.pdf',
            )
            notify(order.user, 'order_placed',
                   f'Order #{order.id} Confirmed — Cash on Delivery',
                   f'Your order #{order.id} is confirmed. Pay BDT {order.total_amount:.2f} upon delivery.')

        return Response({
            'order_id': order.id,
            'message': 'Order confirmed. Pay on delivery.',
        }, status=status.HTTP_201_CREATED)


class AdminPaymentListView(APIView):
    """Admin view to list all payments with optional status filter."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in ('admin', 'superadmin'):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        payments = Payment.objects.select_related('order', 'order__user').order_by('-created_at')
        status_filter = request.query_params.get('status')
        if status_filter:
            payments = payments.filter(status=status_filter)

        order_id = request.query_params.get('order_id')
        if order_id:
            payments = payments.filter(order_id=order_id)

        return Response(PaymentSerializer(payments, many=True).data)


class AdminPaymentDetailView(APIView):
    """Admin view to manually override a payment's status."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if request.user.role not in ('admin', 'superadmin'):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            payment = Payment.objects.select_related('order', 'order__user').get(pk=pk)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminPaymentUpdateSerializer(payment, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        old_status = payment.status
        serializer.save()

        from users.audit_utils import audit
        audit(
            request.user, 'payment_status_override', 'Payment', payment.pk,
            f'Changed payment #{payment.pk} status from {old_status} to {payment.status} (Order #{payment.order_id})'
        )

        return Response(PaymentSerializer(payment).data)

    def delete(self, request, pk):
        if request.user.role not in ('admin', 'superadmin'):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            payment = Payment.objects.select_related('order').get(pk=pk)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found.'}, status=status.HTTP_404_NOT_FOUND)

        from users.audit_utils import audit
        audit(
            request.user, 'payment_delete', 'Payment', payment.pk,
            f'Deleted payment #{payment.pk} for Order #{payment.order_id}'
        )

        payment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
