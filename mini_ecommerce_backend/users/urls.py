from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomAuthToken, LogoutView, RegisterView, ProfileView,
    ForgotPasswordView, ResetPasswordConfirmView, ResetPasswordView,
    AvatarUploadView,
    AdminUserListView, AdminUserDetailView, AdminListView,
    UserAddressListCreateView, UserAddressDetailView, UserAddressSetDefaultView,
    TwoFASetupView, TwoFAVerifySetupView, TwoFAConfirmLoginView,
    TwoFADisableView, TwoFAStatusView,
    ProfileExportView, ProfileDeleteView,
    AuditLogListView,
)

urlpatterns = [
    # Auth
    path('auth/login/', CustomAuthToken.as_view(), name='api_token_auth'),
    path('auth/logout/', LogoutView.as_view(), name='api_token_logout'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/profile/', ProfileView.as_view(), name='auth_profile'),
    path('auth/profile/avatar/', AvatarUploadView.as_view(), name='auth_profile_avatar'),
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('auth/reset-password/<str:uid>/<str:token>/', ResetPasswordConfirmView.as_view(), name='reset_password_confirm'),
    path('auth/update-password/', ResetPasswordView.as_view(), name='update_password'),

    # 2FA
    path('auth/2fa/status/', TwoFAStatusView.as_view(), name='2fa_status'),
    path('auth/2fa/setup/', TwoFASetupView.as_view(), name='2fa_setup'),
    path('auth/2fa/verify-setup/', TwoFAVerifySetupView.as_view(), name='2fa_verify_setup'),
    path('auth/2fa/confirm/', TwoFAConfirmLoginView.as_view(), name='2fa_confirm'),
    path('auth/2fa/disable/', TwoFADisableView.as_view(), name='2fa_disable'),

    # GDPR
    path('profile/export/', ProfileExportView.as_view(), name='profile_export'),
    path('profile/delete/', ProfileDeleteView.as_view(), name='profile_delete'),

    # Address book
    path('addresses/', UserAddressListCreateView.as_view(), name='address_list_create'),
    path('addresses/<int:pk>/', UserAddressDetailView.as_view(), name='address_detail'),
    path('addresses/<int:pk>/set-default/', UserAddressSetDefaultView.as_view(), name='address_set_default'),

    # Admin — User management
    path('admin/users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin_user_detail'),

    # Superadmin — Admin management
    path('admin/admins/', AdminListView.as_view(), name='admin_list'),

    # Admin — Audit log
    path('admin/audit-log/', AuditLogListView.as_view(), name='admin_audit_log'),
]
