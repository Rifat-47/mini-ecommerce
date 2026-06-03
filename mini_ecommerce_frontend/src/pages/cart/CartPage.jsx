import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { cn, cldUrl } from '@/lib/utils'
import useCartStore from '@/store/cartStore'
import useAuthStore from '@/store/authStore'
import { getErrorMessage } from '@/lib/errors'

function CartItem({ item }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)

  async function handleRemove() {
    try {
      await removeItem(item.product_id)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove item'))
    }
  }

  async function handleUpdateQuantity(qty) {
    try {
      await updateQuantity(item.product_id, qty)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update quantity'))
    }
  }

  const discountPct = parseFloat(item.discount_percentage || 0)
  const originalPrice = parseFloat(item.price)
  const effectivePrice = discountPct > 0 ? originalPrice * (1 - discountPct / 100) : originalPrice
  const lineTotal = effectivePrice * item.quantity

  return (
    <div className="flex gap-4 py-4">
      {/* Image */}
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

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Link to={`/products/${item.product_id}`} className="font-medium text-sm hover:underline line-clamp-2">
          {item.name}
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">৳{effectivePrice.toFixed(2)}</span>
          {discountPct > 0 && (
            <span className="text-xs text-muted-foreground line-through">৳{originalPrice.toFixed(2)}</span>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto gap-2">
          {/* Quantity controls + max stock hint */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center border border-border rounded-lg overflow-hidden w-fit">
              <button
                onClick={() => handleUpdateQuantity(item.quantity - 1)}
                className="px-2 py-1.5 hover:bg-accent transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="px-3 py-1.5 text-sm font-medium min-w-[2.5rem] text-center select-none">
                {item.quantity}
              </span>
              <button
                onClick={() => handleUpdateQuantity(item.quantity + 1)}
                disabled={item.quantity >= item.stock}
                className={cn(
                  'px-2 py-1.5 transition-colors',
                  item.quantity >= item.stock
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-accent',
                )}
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {item.quantity >= item.stock && (
              <p className="text-xs text-amber-500 dark:text-amber-400 leading-tight">
                Max stock reached ({item.stock} available)
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-semibold hidden sm:block">৳{lineTotal.toFixed(2)}</span>
            <button
              onClick={handleRemove}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CartPage() {
  const items = useCartStore((s) => s.items)
  const isSyncing = useCartStore((s) => s.isSyncing)
  const clearCart = useCartStore((s) => s.clearCart)
  const getTotal = useCartStore((s) => s.getTotal)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const total = getTotal()
  const itemCount = getItemCount()

  if (isSyncing) {
    return (
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-40 mb-6" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl divide-y divide-border px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 py-4">
                <Skeleton className="w-24 h-24 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-7 w-24 mt-2" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 h-fit">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          message="Browse our products and add something you love."
          action={{ label: 'Start shopping', onClick: () => window.location.href = '/' }}
        />
      </div>
    )
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Shopping Cart</h1>
          <button
            onClick={async () => {
              try {
                await clearCart()
              } catch (err) {
                toast.error(getErrorMessage(err, 'Failed to clear cart'))
              }
            }}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear cart
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items list */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl divide-y divide-border px-4">
              {items.map((item) => (
                <CartItem key={item.product_id} item={item} />
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 lg:sticky lg:top-24">
              <h2 className="font-semibold text-lg">Order Summary</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items ({itemCount})</span>
                  <span>৳{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-semibold text-base">
                <span>Subtotal</span>
                <span>৳{total.toFixed(2)}</span>
              </div>

              {isAuthenticated() ? (
                <Link to="/checkout">
                  <Button className="w-full mt-2">
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Proceed to Checkout
                  </Button>
                </Link>
              ) : (
                <div className="space-y-2">
                  <Link to="/login" state={{ from: '/checkout' }}>
                    <Button className="w-full">Login to Checkout</Button>
                  </Link>
                  <p className="text-xs text-center text-muted-foreground">
                    Your cart is saved — login to complete your order.
                  </p>
                </div>
              )}

              <Link to="/" className="block text-center text-sm text-primary hover:underline">
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
