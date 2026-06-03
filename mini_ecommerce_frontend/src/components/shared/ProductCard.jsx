import { Link } from 'react-router-dom'
import { ShoppingCart, Heart, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { cn, cldUrl } from '@/lib/utils'
import useCartStore from '@/store/cartStore'
import useWishlistStore from '@/store/wishlistStore'
import useAuthStore from '@/store/authStore'
import { getErrorMessage } from '@/lib/errors'
import StarRating from '@/components/shared/StarRating'

export default function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem)
  const inCart = useCartStore((s) => s.items.some((i) => i.product_id === product.id))
  const wishlisted = useWishlistStore((s) => s.items.some((i) => i.product_id === product.id))
  const isSyncing = useWishlistStore((s) => s.isSyncing)
  const addToWishlist = useWishlistStore((s) => s.addItem)
  const addToBackend = useWishlistStore((s) => s.addToBackend)
  const removeFromWishlist = useWishlistStore((s) => s.removeItem)
  const removeFromBackend = useWishlistStore((s) => s.removeFromBackend)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const {
    id,
    name,
    price,
    discount_percentage,
    average_rating,
    review_count,
    stock,
    status,
    images = [],
  } = product

  const primaryImage = images.find((img) => img.is_primary)?.image || null
  const discountPct = parseFloat(discount_percentage || 0)
  const originalPrice = parseFloat(price)
  const effectivePrice = discountPct > 0
    ? originalPrice * (1 - discountPct / 100)
    : originalPrice
  const isComingSoon = status === 'coming_soon'
  const inStock = stock > 0 && !isComingSoon

  async function handleAddToCart(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!inStock) return
    try {
      await addItem(product, 1)
      toast.success(`${name} added to cart`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add to cart'))
    }
  }

  function handleWishlist(e) {
    e.preventDefault()
    e.stopPropagation()
    if (wishlisted) {
      isAuthenticated() ? removeFromBackend(id) : removeFromWishlist(id)
    } else {
      isAuthenticated() ? addToBackend(product) : addToWishlist(product)
    }
  }

  return (
    <TooltipProvider>
    <Link
      to={`/products/${id}`}
      className="group flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/20 transition-all duration-200 h-full"
    >
      {/* Image */}
      <div className="relative aspect-square bg-secondary overflow-hidden">
        {primaryImage ? (
          <img
            src={cldUrl(primaryImage, 'f_auto,q_auto,w_400,c_fill')}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ShoppingCart className="h-8 w-8 opacity-30" />
            <span className="text-xs">No image</span>
          </div>
        )}

        {/* Discount badge */}
        {discountPct > 0 && (
          <Badge className="absolute top-2.5 left-2.5 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-lg shadow-sm">
            -{Math.round(discountPct)}%
          </Badge>
        )}

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          disabled={isSyncing}
          className={cn(
            'absolute top-2.5 right-2.5 p-2 rounded-xl bg-background/85 backdrop-blur-sm shadow-sm border border-border/50 hover:bg-background transition-all duration-150',
            isSyncing
              ? 'text-muted-foreground opacity-50 cursor-wait'
              : wishlisted
              ? 'text-destructive border-destructive/20 bg-destructive/5'
              : 'text-muted-foreground hover:text-destructive',
          )}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={cn('h-3.5 w-3.5', !isSyncing && wishlisted && 'fill-current')} />
        </button>

        {/* Out of stock / Coming soon overlay */}
        {(isComingSoon || !inStock) && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px] flex items-center justify-center">
            <span className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-full border',
              isComingSoon
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-muted text-muted-foreground border-border',
            )}>
              {isComingSoon ? 'Coming Soon' : 'Out of Stock'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2.5">
        <Tooltip content={name}>
          <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug break-words min-h-[2.5rem]">
            {name}
          </h3>
        </Tooltip>

        {/* Rating */}
        {average_rating > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating value={average_rating} />
            <span className="text-xs text-muted-foreground">
              {parseFloat(average_rating).toFixed(1)}
              {review_count > 0 && ` (${review_count})`}
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-auto">
          <span className="font-bold text-base text-primary">
            ৳{effectivePrice.toFixed(2)}
          </span>
          {discountPct > 0 && (
            <span className="text-xs text-muted-foreground line-through">
              ৳{originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Add to cart */}
        <Button
          size="sm"
          disabled={isComingSoon || !inStock || inCart}
          onClick={handleAddToCart}
          variant={inCart ? 'secondary' : 'default'}
          className={cn(
            'w-full mt-0.5 text-xs h-9 rounded-xl',
            isComingSoon && 'bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 cursor-not-allowed',
            !isComingSoon && !inStock && 'opacity-50 cursor-not-allowed',
          )}
        >
          {isComingSoon
            ? <><Clock className="h-3.5 w-3.5 mr-1.5 shrink-0" /> Coming Soon</>
            : inCart
            ? 'Added to Cart ✓'
            : !inStock
            ? 'Out of Stock'
            : <><ShoppingCart className="h-3.5 w-3.5 mr-1.5 shrink-0" /> Add to Cart</>
          }
        </Button>
      </div>
    </Link>
    </TooltipProvider>
  )
}
