import { Link } from 'react-router-dom'
import { ShoppingCart, Heart, Clock, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, cldUrl } from '@/lib/utils'
import useCartStore from '@/store/cartStore'
import useWishlistStore from '@/store/wishlistStore'
import useAuthStore from '@/store/authStore'
import { getErrorMessage } from '@/lib/errors'
import StarRating from '@/components/shared/StarRating'

export default function ProductCard({ product }) {
  const addItem          = useCartStore((s) => s.addItem)
  const inCart           = useCartStore((s) => s.items.some((i) => i.product_id === product.id))
  const wishlisted       = useWishlistStore((s) => s.items.some((i) => i.product_id === product.id))
  const isSyncing        = useWishlistStore((s) => s.isSyncing)
  const addToWishlist    = useWishlistStore((s) => s.addItem)
  const addToBackend     = useWishlistStore((s) => s.addToBackend)
  const removeFromWishlist = useWishlistStore((s) => s.removeItem)
  const removeFromBackend  = useWishlistStore((s) => s.removeFromBackend)
  const isAuthenticated  = useAuthStore((s) => s.isAuthenticated)

  const { id, name, price, discount_percentage, average_rating, review_count, stock, status, images = [] } = product

  const primaryImage  = images.find((img) => img.is_primary)?.image || null
  const discountPct   = parseFloat(discount_percentage || 0)
  const originalPrice = parseFloat(price)
  const effectivePrice = discountPct > 0 ? originalPrice * (1 - discountPct / 100) : originalPrice
  const isComingSoon  = status === 'coming_soon'
  const inStock       = stock > 0 && !isComingSoon

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
    <Link
      to={`/products/${id}`}
      className="group flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/25 hover:shadow-xl hover:shadow-primary/8 hover:-translate-y-1 transition-all duration-300 h-full"
    >
      {/* ── Image area ──────────────────────────────────── */}
      <div className="relative aspect-square bg-secondary overflow-hidden">
        {primaryImage ? (
          <img
            src={cldUrl(primaryImage, 'f_auto,q_auto,w_400,c_fill')}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ShoppingCart className="h-8 w-8 opacity-20" />
            <span className="text-xs opacity-40">No image</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="flex items-center gap-1.5 bg-white/95 dark:bg-card/95 text-foreground text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg translate-y-3 group-hover:translate-y-0 transition-transform duration-300">
            <Eye className="h-3.5 w-3.5" />
            View Product
          </div>
        </div>

        {/* Discount badge */}
        {discountPct > 0 && (
          <Badge className="absolute top-2.5 left-2.5 bg-destructive text-destructive-foreground text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-md">
            -{Math.round(discountPct)}%
          </Badge>
        )}

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          disabled={isSyncing}
          className={cn(
            'absolute top-2.5 right-2.5 p-2 rounded-xl backdrop-blur-sm shadow-sm border transition-all duration-200',
            'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0',
            isSyncing
              ? 'bg-background/80 border-border/50 text-muted-foreground opacity-50 cursor-wait'
              : wishlisted
              ? 'bg-destructive/10 border-destructive/30 text-destructive opacity-100'
              : 'bg-background/85 border-border/50 text-muted-foreground hover:bg-background hover:text-destructive hover:border-destructive/30',
          )}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={cn('h-3.5 w-3.5', !isSyncing && wishlisted && 'fill-current')} />
        </button>

        {/* Out of stock / Coming soon overlay */}
        {(isComingSoon || !inStock) && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
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

      {/* ── Card body ───────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">
          {name}
        </h3>

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
        <div className="flex items-baseline gap-2 mt-auto pt-1">
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
            'w-full mt-1 text-xs h-9 rounded-xl font-semibold transition-all duration-200',
            isComingSoon && 'bg-primary/8 text-primary hover:bg-primary/12 border border-primary/20 cursor-not-allowed',
            !isComingSoon && !inStock && 'opacity-50 cursor-not-allowed',
            !isComingSoon && inStock && !inCart && 'shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/25',
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
  )
}
