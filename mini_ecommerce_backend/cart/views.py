from rest_framework import generics, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import WishlistItem, CartItem
from .serializers import WishlistItemSerializer, CartItemSerializer


# ── Wishlist ──────────────────────────────────────────────────────────────────

class WishlistListCreateView(generics.ListCreateAPIView):
    serializer_class = WishlistItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WishlistItem.objects.filter(user=self.request.user).select_related('product').prefetch_related('product__images').order_by('-added_at')


class WishlistItemDetailView(generics.DestroyAPIView):
    serializer_class = WishlistItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        try:
            return WishlistItem.objects.get(pk=self.kwargs['pk'], user=self.request.user)
        except WishlistItem.DoesNotExist:
            raise NotFound("Wishlist item not found.")


class WishlistMoveToCartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            wishlist_item = WishlistItem.objects.select_related('product').get(pk=pk, user=request.user)
        except WishlistItem.DoesNotExist:
            raise NotFound("Wishlist item not found.")

        product = wishlist_item.product

        # Add or increment in cart
        cart_item, created = CartItem.objects.get_or_create(
            user=request.user,
            product=product,
            defaults={'quantity': 1},
        )
        if created and product.stock < 1:
            cart_item.delete()
            return Response(
                {"detail": f"'{product.name}' is out of stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not created:
            new_quantity = cart_item.quantity + 1
            if product.stock < new_quantity:
                return Response(
                    {"detail": f"Cannot add more. Only {product.stock} units available in stock."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cart_item.quantity = new_quantity
            cart_item.save()

        wishlist_item.delete()

        return Response(CartItemSerializer(cart_item, context={'request': request}).data, status=status.HTTP_200_OK)


# ── Cart ──────────────────────────────────────────────────────────────────────

class CartListCreateView(generics.ListCreateAPIView):
    serializer_class = CartItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CartItem.objects.filter(user=self.request.user).select_related('product').prefetch_related('product__images').order_by('added_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        cart_total = sum(item['line_total'] for item in serializer.data)
        return Response({
            "items": serializer.data,
            "cart_total": round(cart_total, 2),
            "item_count": queryset.count(),
        })

    def delete(self, request):
        """Clear entire cart."""
        CartItem.objects.filter(user=request.user).delete()
        return Response({"message": "Cart cleared."}, status=status.HTTP_200_OK)


class CartItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CartItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete']

    def get_object(self):
        try:
            return CartItem.objects.select_related('product').get(pk=self.kwargs['pk'], user=self.request.user)
        except CartItem.DoesNotExist:
            raise NotFound("Cart item not found.")
