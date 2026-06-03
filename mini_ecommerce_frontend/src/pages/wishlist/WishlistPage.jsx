import { Link } from 'react-router-dom'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/shared/EmptyState'
import useWishlistStore from '@/store/wishlistStore'
import useCartStore from '@/store/cartStore'
import useAuthStore from '@/store/authStore'
import api from '@/api/axios'
import { getErrorMessage } from '@/lib/errors'
import { cldUrl } from '@/lib/utils'

function WishlistItem({ item, isAuthenticated }) {
  const removeItem = useWishlistStore((s) => s.removeItem)
  const removeFromBackend = useWishlistStore((s) => s.removeFromBackend)
  const addCartItem = useCartStore((s) => s.addItem)
  const addBackendCartItem = useCartStore((s) => s.addBackendCartItem)

  const discountPct = parseFloat(item.discount_percentage || 0)
  const originalPrice = parseFloat(item.price)
  const effectivePrice = discountPct > 0 ? originalPrice * (1 - discountPct / 100) : originalPrice
  const inStock = item.stock > 0

  async function handleMoveToCart() {
    if (isAuthenticated && item.wishlist_item_id) {
      try {
        const { data: cartItem } = await api.post(`/wishlist/${item.wishlist_item_id}/move-to-cart/`)
        addBackendCartItem(cartItem, item.image || null)
        removeItem(item.product_id)
        toast.success('Moved to cart')
        return
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to move to cart'))
        return
      }
    }
    // Guest: add to cart locally and remove from wishlist
    try {
      await addCartItem({
        id: item.product_id,
        name: item.name,
        price: item.price,
        discount_percentage: item.discount_percentage,
        stock: item.stock,
        images: item.image ? [{ is_primary: true, image: item.image }] : [],
      })
      isAuthenticated ? removeFromBackend(item.product_id) : removeItem(item.product_id)
      toast.success('Moved to cart')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to move to cart'))
    }
  }

  async function handleRemove() {
    try {
      isAuthenticated ? await removeFromBackend(item.product_id) : removeItem(item.product_id)
      toast.success('Removed from wishlist')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove from wishlist'))
    }
  }

  return (
    <div className="flex gap-4 bg-card border border-border rounded-xl p-4">
      <Link to={`/products/${item.product_id}`} className="shrink-0">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-secondary overflow-hidden">
          {item.image ? (
            <img
              src={cldUrl(item.image, 'f_auto,q_auto,w_192,c_fill')}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextSibling.style.display = 'flex'
              }}
            />
          ) : null}
          <div
            className="w-full h-full items-center justify-center text-xs text-muted-foreground"
            style={{ display: item.image ? 'none' : 'flex' }}
          >
            No img
          </div>
        </div>
      </Link>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Link to={`/products/${item.product_id}`} className="font-medium text-sm hover:underline line-clamp-2">
          {item.name}
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">৳{effectivePrice.toFixed(2)}</span>
          {discountPct > 0 && (
            <span className="text-xs text-muted-foreground line-through">৳{originalPrice.toFixed(2)}</span>
          )}
        </div>

        <p className={`text-xs font-medium ${inStock ? 'text-success' : 'text-destructive'}`}>
          {inStock ? 'In stock' : 'Out of stock'}
        </p>

        <div className="flex items-center gap-2 mt-auto">
          <Button
            size="sm"
            variant="outline"
            disabled={!inStock}
            onClick={handleMoveToCart}
            className="text-xs h-7"
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Move to Cart
          </Button>
          <button
            onClick={handleRemove}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
            aria-label="Remove from wishlist"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WishlistPage() {
  const items = useWishlistStore((s) => s.items)
  const isSyncing = useWishlistStore((s) => s.isSyncing)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())

  if (isSyncing) {
    return (
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-3">
        <Skeleton className="h-8 w-40 mb-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 bg-card border border-border rounded-xl p-4">
            <Skeleton className="w-24 h-24 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-7 w-28 mt-auto" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          message="Save products you love and come back to them later."
          action={{ label: 'Browse products', onClick: () => window.location.href = '/' }}
        />
      </div>
    )
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        Wishlist <span className="text-muted-foreground font-normal text-lg">({items.length})</span>
      </h1>

      <div className="space-y-3">
        {items.map((item) => (
          <WishlistItem key={item.product_id} item={item} isAuthenticated={isAuthenticated} />
        ))}
      </div>
    </div>
  )
}
