from rest_framework import status, views, permissions, generics
from rest_framework.response import Response
from rest_framework.exceptions import NotFound
from rest_framework.throttling import AnonRateThrottle
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model, authenticate
from django.utils import timezone
from .models import UserAddress, AuditLog
from .serializers import (
    RegisterSerializer, UserSerializer, ProfileSerializer,
    UserAddressSerializer, AuditLogSerializer,
)
from .permissions import IsAdminOrSuperAdmin, IsSuperAdmin
from .audit_utils import audit
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from ecommerce_backend.email_utils import send_mail_async as _send_mail_async
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
import pyotp, qrcode, base64
from io import BytesIO


# ── Throttle classes ─────────────────────────────────────────────────────────

class LoginThrottle(AnonRateThrottle):
    rate = '10/min'
    scope = 'login'

class RegisterThrottle(AnonRateThrottle):
    rate = '5/min'
    scope = 'register'

class ForgotPasswordThrottle(AnonRateThrottle):
    rate = '5/min'
    scope = 'forgot_password'

User = get_user_model()

class CustomAuthToken(views.APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_classes = [LoginThrottle]

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({'error': 'Please provide both email and password'}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch user first to apply lockout check before authenticate()
        User = get_user_model()
        try:
            user_obj = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        if user_obj.is_locked_out():
            remaining = int((user_obj.lockout_until - timezone.now()).total_seconds() // 60) + 1
            return Response(
                {'error': f'Account locked due to too many failed login attempts. Try again in {remaining} minute(s).'},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = authenticate(request, email=email, password=password)

        if not user:
            from config.models import SiteSettings
            cfg = SiteSettings.get()
            max_attempts = cfg.max_login_attempts
            lockout_mins = cfg.lockout_minutes
            user_obj.record_failed_login()
            attempts_left = max(0, max_attempts - user_obj.failed_login_attempts)
            msg = 'Invalid credentials.'
            if attempts_left == 0:
                msg = f'Invalid credentials. Account locked for {lockout_mins} minutes.'
            elif attempts_left <= 2:
                msg = f'Invalid credentials. {attempts_left} attempt(s) remaining before lockout.'
            return Response({'error': msg}, status=status.HTTP_401_UNAUTHORIZED)

        user.reset_failed_login()

        # 2FA check — if enabled, issue a short-lived 2fa_token instead of JWT
        # FRONTEND NOTE: If `requires_2fa: true` is returned, do NOT store any tokens yet.
        # Show a TOTP input screen and call POST /auth/2fa/confirm/ with the code + 2fa_token.
        if user.totp_enabled:
            import secrets
            from django.core.cache import cache
            two_fa_token = secrets.token_urlsafe(32)
            cache.set(f'2fa_pending:{two_fa_token}', user.pk, timeout=300)  # 5 min TTL
            return Response({
                'requires_2fa': True,
                '2fa_token': two_fa_token,
            }, status=status.HTTP_200_OK)

        refresh = RefreshToken.for_user(user)
        avatar_url = None
        if user.avatar:
            url = user.avatar.url
            avatar_url = url if url.startswith('http') else request.build_absolute_uri(url)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'id': user.id,
            'role': user.role,
            'email': user.email,
            'first_name': user.first_name,
            'avatar_url': avatar_url,
            'requires_2fa': False,
        })

class LogoutView(views.APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'error': 'Refresh token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({'error': 'Invalid or expired refresh token.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer
    throttle_classes = [RegisterThrottle]

    def create(self, request, *args, **kwargs):
        from config.models import SiteSettings
        if not SiteSettings.get().registration_enabled:
            return Response(
                {'detail': 'New registrations are currently disabled.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = ProfileSerializer

    def get_object(self):
        return self.request.user


class ForgotPasswordView(views.APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_classes = [ForgotPasswordThrottle]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'message': 'If an account with that email exists, a password reset link has been sent.'}, status=status.HTTP_200_OK)

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        from django.conf import settings as django_settings
        reset_link = f"{django_settings.FRONTEND_URL}/reset-password/{uid}/{token}/"

        from config.models import SiteSettings
        cfg = SiteSettings.get()
        if cfg.email_notifications_enabled:
            _send_mail_async(
                'Password Reset Request',
                f'Click the link below to reset your password:\n\n{reset_link}\n\nThis link expires in 24 hours.',
                cfg.from_email,
                [user.email],
            )

        return Response({'message': 'If an account with that email exists, a password reset link has been sent.'}, status=status.HTTP_200_OK)


class ResetPasswordConfirmView(views.APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request, uid, token):
        new_password = request.data.get('new_password')
        if not new_password:
            return Response({'error': 'New password is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) > 20:
            return Response({'error': 'Password must be at most 20 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Reset link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user)
        except DjangoValidationError as e:
            return Response({'error': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)

class ResetPasswordView(views.APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response({'error': 'Both old_password and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) > 20:
            return Response({'error': 'Password must be at most 20 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(old_password):
            return Response({'error': 'Wrong old password'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user)
        except DjangoValidationError as e:
            return Response({'error': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password reset successful'}, status=status.HTTP_200_OK)


class AvatarUploadView(views.APIView):
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)

    ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
    MAX_SIZE = 2 * 1024 * 1024  # 2 MB

    def post(self, request):
        file = request.FILES.get('avatar')
        if not file:
            return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        if file.content_type not in self.ALLOWED_TYPES:
            return Response({'error': 'Only JPG, PNG, and WebP images are allowed.'}, status=status.HTTP_400_BAD_REQUEST)
        if file.size > self.MAX_SIZE:
            return Response({'error': 'Image must be under 2 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if user.avatar:
            user.avatar.delete(save=False)

        user.avatar = file
        user.save(update_fields=['avatar'])

        url = user.avatar.url
        avatar_url = url if url.startswith('http') else request.build_absolute_uri(url)
        return Response({'avatar_url': avatar_url}, status=status.HTTP_200_OK)

    def delete(self, request):
        user = request.user
        if user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
            user.save(update_fields=['avatar'])
        return Response({'message': 'Avatar removed.'}, status=status.HTTP_200_OK)


class AdminUserListView(generics.ListCreateAPIView):
    permission_classes = (IsAdminOrSuperAdmin,)
    serializer_class = UserSerializer

    def get_queryset(self):
        queryset = User.objects.all()
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        return queryset

    def perform_create(self, serializer):
        user = serializer.save()
        audit(self.request.user, 'user_create', 'User', user.pk, f'Created user {user.email} with role {user.role}')


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (IsAdminOrSuperAdmin,)
    serializer_class = UserSerializer
    queryset = User.objects.all()

    def perform_update(self, serializer):
        incoming_role = serializer.validated_data.get('role')
        if incoming_role in ('admin', 'superadmin') and self.request.user.role != 'superadmin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only superadmins can assign admin or superadmin roles.")
        user = serializer.save()
        audit(self.request.user, 'user_update', 'User', user.pk, f'Updated user {user.email}')

    def perform_destroy(self, instance):
        audit(self.request.user, 'user_delete', 'User', instance.pk, f'Deleted user {instance.email}')
        instance.delete()


class AdminListView(generics.ListAPIView):
    """Superadmin-only — list all admin and superadmin users."""
    permission_classes = (IsSuperAdmin,)
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.filter(role__in=['admin', 'superadmin']).order_by('role', 'email')


class UserAddressListCreateView(generics.ListCreateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserAddressSerializer

    def get_queryset(self):
        return UserAddress.objects.filter(user=self.request.user)


class UserAddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserAddressSerializer

    def get_queryset(self):
        return UserAddress.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        was_default_shipping = instance.is_default_shipping
        was_default_billing = instance.is_default_billing
        self.perform_destroy(instance)

        # Promote the next most recent address as default if the deleted one was default
        if was_default_shipping:
            next_addr = UserAddress.objects.filter(user=request.user).first()
            if next_addr:
                next_addr.is_default_shipping = True
                next_addr.save(update_fields=['is_default_shipping'])

        if was_default_billing:
            next_addr = UserAddress.objects.filter(user=request.user).first()
            if next_addr:
                next_addr.is_default_billing = True
                next_addr.save(update_fields=['is_default_billing'])

        return Response({"message": "Address deleted successfully."}, status=status.HTTP_200_OK)


class UserAddressSetDefaultView(views.APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, pk):
        try:
            address = UserAddress.objects.get(pk=pk, user=request.user)
        except UserAddress.DoesNotExist:
            raise NotFound("Address not found.")

        default_type = request.data.get('type')
        if default_type == 'shipping':
            address.set_as_default_shipping()
        elif default_type == 'billing':
            address.set_as_default_billing()
        else:
            return Response(
                {"error": "Provide 'type' as 'shipping' or 'billing'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(UserAddressSerializer(address).data)


# ── 2FA ──────────────────────────────────────────────────────────────────────

class TwoFASetupView(views.APIView):
    """
    Step 1: Generate a TOTP secret and return a QR code for the user to scan.
    FRONTEND NOTE: Render the returned `qr_code` (base64 PNG) as an <img> tag.
    Also show the `secret` as a manual entry fallback for users who cannot scan.
    Do NOT consider 2FA enabled until the user calls /auth/2fa/verify-setup/ with a valid code.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        user = request.user
        secret = pyotp.random_base32()
        # Store tentative secret — only committed on successful verify-setup
        user.totp_secret = secret
        user.save(update_fields=['totp_secret'])

        totp = pyotp.TOTP(secret)
        from config.models import SiteSettings
        uri = totp.provisioning_uri(name=user.email, issuer_name=SiteSettings.get().store_name)

        img = qrcode.make(uri)
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        qr_b64 = base64.b64encode(buffer.getvalue()).decode()

        return Response({
            'secret': secret,
            'qr_code': f'data:image/png;base64,{qr_b64}',
            'message': 'Scan the QR code with your authenticator app, then call /auth/2fa/verify-setup/ to enable 2FA.',
        })


class TwoFAVerifySetupView(views.APIView):
    """
    Step 2: Confirm the TOTP code from the authenticator app to activate 2FA.
    FRONTEND NOTE: Show a 6-digit input after the QR code screen.
    On success, inform the user that 2FA is now active on their account.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        user = request.user
        code = request.data.get('code', '').strip()

        if not code:
            return Response({'error': 'code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.totp_secret:
            return Response({'error': 'No 2FA setup in progress. Call /auth/2fa/setup/ first.'}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=1):
            return Response({'error': 'Invalid or expired code. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

        user.totp_enabled = True
        user.save(update_fields=['totp_enabled'])
        return Response({'message': '2FA has been enabled on your account.'})


class TwoFAConfirmLoginView(views.APIView):
    """
    Step 3 (at login): Submit TOTP code + 2fa_token to complete login when 2FA is enabled.
    FRONTEND NOTE: After a login response with `requires_2fa: true`, show a 6-digit input.
    Submit `code` (from authenticator app) + `2fa_token` (from login response) to this endpoint.
    On success, store the returned `access` and `refresh` tokens exactly like a normal login.
    The 2fa_token expires in 5 minutes — if it expires, the user must log in again from scratch.
    """
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        two_fa_token = request.data.get('2fa_token', '').strip()
        code = request.data.get('code', '').strip()

        if not two_fa_token or not code:
            return Response({'error': 'Both 2fa_token and code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.core.cache import cache
        User = get_user_model()
        user_pk = cache.get(f'2fa_pending:{two_fa_token}')
        if not user_pk:
            return Response({'error': '2FA session expired or invalid. Please log in again.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            user = User.objects.get(pk=user_pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_401_UNAUTHORIZED)

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=1):
            return Response({'error': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)

        cache.delete(f'2fa_pending:{two_fa_token}')

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'role': user.role,
            'email': user.email,
        })


class TwoFADisableView(views.APIView):
    """
    Disable 2FA. Requires current TOTP code to confirm intent.
    FRONTEND NOTE: Show a confirmation dialog asking for the current TOTP code before disabling.
    After success, update the user's account settings UI to reflect 2FA is off.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        user = request.user

        if not user.totp_enabled:
            return Response({'error': '2FA is not enabled on your account.'}, status=status.HTTP_400_BAD_REQUEST)

        code = request.data.get('code', '').strip()
        if not code:
            return Response({'error': 'code is required to disable 2FA.'}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=1):
            return Response({'error': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)

        user.totp_enabled = False
        user.totp_secret = ''
        user.save(update_fields=['totp_enabled', 'totp_secret'])
        return Response({'message': '2FA has been disabled on your account.'})


class TwoFAStatusView(views.APIView):
    """Return whether 2FA is currently enabled for the authenticated user."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response({'totp_enabled': request.user.totp_enabled})


# ── GDPR ─────────────────────────────────────────────────────────────────────

class ProfileExportView(views.APIView):
    """
    GDPR data export. Returns all personal data stored for the authenticated user.
    FRONTEND NOTE: Trigger this from a "Download My Data" button in account settings.
    The response is JSON — the frontend can offer it as a downloadable .json file.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from orders.models import Order
        user = request.user

        orders = []
        for order in Order.objects.filter(user=user).prefetch_related('items__product'):
            orders.append({
                'id': order.id,
                'status': order.status,
                'shipping_address': order.shipping_address,
                'total_amount': str(order.total_amount),
                'discount_amount': str(order.discount_amount),
                'coupon': order.coupon.code if order.coupon else None,
                'created_at': order.created_at.isoformat(),
                'items': [
                    {
                        'product': item.product.name,
                        'quantity': item.quantity,
                        'price_at_purchase': str(item.price_at_purchase),
                    }
                    for item in order.items.all()
                ],
            })

        addresses = [
            {
                'label': a.label,
                'full_name': a.full_name,
                'phone': a.phone,
                'address_line_1': a.address_line_1,
                'address_line_2': a.address_line_2,
                'city': a.city,
                'state': a.state,
                'postal_code': a.postal_code,
                'country': a.country,
            }
            for a in user.addresses.all()
        ]

        data = {
            'profile': {
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'date_of_birth': str(user.date_of_birth) if user.date_of_birth else None,
                'role': user.role,
                'date_joined': user.date_joined.isoformat(),
            },
            'addresses': addresses,
            'orders': orders,
        }

        return Response(data)


class ProfileDeleteView(views.APIView):
    """
    GDPR account deletion. Permanently deletes the account.
    Orders are anonymised (user FK set to null via SET_NULL) to preserve financial records.
    FRONTEND NOTE: Show a strong confirmation dialog ("Type your email to confirm deletion").
    After success, clear all local tokens and redirect to the homepage.
    Password confirmation is required — pass `password` in the request body.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request):
        user = request.user
        password = request.data.get('password', '')

        if not password:
            return Response({'error': 'password is required to confirm account deletion.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(password):
            return Response({'error': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)

        user.delete()
        return Response({'message': 'Your account has been permanently deleted.'}, status=status.HTTP_200_OK)


# ── Admin Audit Log ───────────────────────────────────────────────────────────

class AuditLogListView(generics.ListAPIView):
    """Superadmin-only audit log. Supports ?action= and ?admin_id= filters."""
    permission_classes = (IsSuperAdmin,)
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.select_related('admin').all()
        action_filter = self.request.query_params.get('action')
        admin_filter = self.request.query_params.get('admin_id')
        if action_filter:
            qs = qs.filter(action=action_filter)
        if admin_filter:
            qs = qs.filter(admin_id=admin_filter)
        return qs
