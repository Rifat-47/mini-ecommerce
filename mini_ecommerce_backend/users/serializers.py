from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import UserAddress, AuditLog

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'public_id', 'email', 'first_name', 'last_name', 'role', 'date_of_birth', 'password']
        extra_kwargs = {
            'password': {'write_only': True, 'min_length': 8, 'max_length': 20},
            'role': {'required': True},
            'first_name': {'max_length': 25},
            'last_name': {'max_length': 25},
        }
    
    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
        
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


class ProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'public_id', 'email', 'first_name', 'last_name', 'date_of_birth', 'password', 'avatar_url']
        extra_kwargs = {
            'password': {'write_only': True, 'required': False, 'min_length': 8, 'max_length': 20},
            'email': {'read_only': True},
            'first_name': {'max_length': 25},
            'last_name': {'max_length': 25},
        }

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        url = obj.avatar.url
        if url.startswith('http'):
            return url
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=20)

    class Meta:
        model = User
        fields = ['email', 'password', 'first_name', 'last_name', 'date_of_birth', 'role']
        extra_kwargs = {
            'role': {'read_only': True},
            'first_name': {'max_length': 25},
            'last_name': {'max_length': 25},
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            date_of_birth=validated_data.get('date_of_birth')
        )
        return user


class AuditLogSerializer(serializers.ModelSerializer):
    admin_email = serializers.ReadOnlyField(source='admin.email')

    class Meta:
        model = AuditLog
        fields = ['id', 'admin_email', 'action', 'target_type', 'target_id', 'detail', 'created_at']
        read_only_fields = fields


class UserAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAddress
        fields = [
            'id', 'label', 'full_name', 'phone',
            'address_line_1', 'address_line_2',
            'city', 'state', 'postal_code', 'country',
            'is_default_shipping', 'is_default_billing',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'label':           {'max_length': 50,  'required': False},
            'full_name':       {'min_length': 2,   'max_length': 255},
            'phone':           {'min_length': 7,   'max_length': 20},
            'address_line_1':  {'min_length': 5,   'max_length': 255},
            'address_line_2':  {'max_length': 255, 'required': False},
            'city':            {'min_length': 2,   'max_length': 100},
            'state':           {'min_length': 2,   'max_length': 100},
            'postal_code':     {'min_length': 3,   'max_length': 20},
            'country':         {'min_length': 2,   'max_length': 100},
        }

    def create(self, validated_data):
        user = self.context['request'].user
        is_default_shipping = validated_data.get('is_default_shipping', False)
        is_default_billing = validated_data.get('is_default_billing', False)

        if is_default_shipping:
            UserAddress.objects.filter(user=user, is_default_shipping=True).update(is_default_shipping=False)
        if is_default_billing:
            UserAddress.objects.filter(user=user, is_default_billing=True).update(is_default_billing=False)

        # Auto-set as default if it's the user's first address
        if not UserAddress.objects.filter(user=user).exists():
            validated_data['is_default_shipping'] = True
            validated_data['is_default_billing'] = True

        return UserAddress.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        user = instance.user
        is_default_shipping = validated_data.get('is_default_shipping', instance.is_default_shipping)
        is_default_billing = validated_data.get('is_default_billing', instance.is_default_billing)

        if is_default_shipping and not instance.is_default_shipping:
            UserAddress.objects.filter(user=user, is_default_shipping=True).update(is_default_shipping=False)
        if is_default_billing and not instance.is_default_billing:
            UserAddress.objects.filter(user=user, is_default_billing=True).update(is_default_billing=False)

        return super().update(instance, validated_data)
