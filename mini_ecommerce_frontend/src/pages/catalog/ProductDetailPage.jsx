import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShoppingCart, Heart, ChevronLeft, ChevronRight, Minus, Plus, Clock, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import StarRating from '@/components/shared/StarRating'
import ErrorMessage from '@/components/shared/ErrorMessage'
import MaxLengthWarning from '@/components/shared/MaxLengthWarning'
import api from '@/api/axios'
import useCartStore from '@/store/cartStore'
import useWishlistStore from '@/store/wishlistStore'
import useAuthStore from '@/store/authStore'
import { getErrorMessage } from '@/lib/errors'

function ImageGallery({ images }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const sorted = [...images].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))

  function prev() { setActiveIdx((i) => (i === 0 ? sorted.length - 1 : i - 1)) }
  function next() { setActiveIdx((i) => (i === sorted.length - 1 ? 0 : i + 1)) }

  if (!sorted.length) {
    return (
      <div className="aspect-square bg-secondary rounded-xl flex items-center justify-center text-muted-foreground">
        No image
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square bg-secondary rounded-xl overflow-hidden group">
        <img src={sorted[activeIdx]?.image} alt="Product" className="w-full h-full object-cover" />
        {sorted.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {sorted.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {sorted.map((img, i) => (
            <button key={img.id} onClick={() => setActiveIdx(i)} className={cn('w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors', activeIdx === i ? 'border-primary' : 'border-border')}>
              <img src={img.image} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ review, productId, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(review.rating)
  const [comment, setComment] = useState(review.comment || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)

  async function handleUpdate(e) {
    e.preventDefault()
    if (!rating) return
    setSaving(true)
    setError(null)
    try {
      await api.patch(`/products/${productId}/reviews/${review.id}/`, { rating, comment })
      toast.success('Review updated.')
      setEditing(false)
      onChanged?.()
    } catch (err) {
      const data = err.response?.data
      const msg = Array.isArray(data) ? data[0] : (data?.non_field_errors?.[0] ?? data?.detail ?? data?.error ?? 'Failed to update review.')
      setError({ error: msg })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/products/${productId}/reviews/${review.id}/`)
      toast.success('Review deleted.')
      onChanged?.()
    } catch (err) {
      const data = err.response?.data
      const msg = data?.detail ?? data?.error ?? 'Failed to delete review.'
      toast.error(msg)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="border border-border rounded-lg p-4">
      {editing ? (
        <form onSubmit={handleUpdate} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{review.reviewer_name || 'Anonymous'}</span>
            <button type="button" onClick={() => { setEditing(false); setRating(review.rating); setComment(review.comment || ''); setError(null) }} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
          <ErrorMessage error={error} />
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Your rating</p>
            <StarRating value={rating} interactive onChange={setRating} size="lg" />
          </div>
          <div>
            <Textarea placeholder="Share your experience (optional)" value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={1000} />
            <MaxLengthWarning value={comment} max={1000} />
            <p className="text-xs text-muted-foreground mt-1 text-right">{comment.length}/1000</p>
          </div>
          <Button type="submit" size="sm" disabled={saving || !rating}>{saving ? 'Saving…' : 'Save'}</Button>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0">
              <span className="font-medium text-sm">{review.reviewer_name || 'Anonymous'}</span>
              <span className="text-xs text-muted-foreground ml-2">{new Date(review.created_at).toLocaleDateString()}</span>
            </div>
            {review.can_edit && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setEditing(true); setConfirmDelete(false) }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit review">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {confirmDelete ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-destructive">Delete?</span>
                    <button onClick={handleDelete} disabled={deleting} className="text-xs font-medium text-destructive hover:underline disabled:opacity-50">{deleting ? '…' : 'Yes'}</button>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:underline">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" aria-label="Delete review">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
          <StarRating value={review.rating} />
          {review.comment && <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>}
        </>
      )}
    </div>
  )
}

function ReviewForm({ productId, onSubmitted, reviews = [] }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!rating) errors.rating = 'Please select a rating.'
    if (comment.length > 1000) errors.comment = 'Comment must be at most 1000 characters.'
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})
    setError(null)
    setLoading(true)
    try {
      await api.post(`/products/${productId}/reviews/`, { rating, comment })
      toast.success('Review submitted!')
      setSubmitted(true)
      onSubmitted?.()
    } catch (err) {
      const data = err.response?.data
      const msg = Array.isArray(data) ? data[0] : (data?.non_field_errors?.[0] ?? data?.detail ?? data?.error ?? 'Failed to submit review.')
      setError({ error: msg })
    } finally {
      setLoading(false)
    }
  }

  const { user } = useAuthStore()
  const alreadyReviewed = reviews.some(r => r.reviewer_email === user?.email)

  if (submitted || alreadyReviewed) {
    return null
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 mt-6 border-t border-border pt-6">
      <h3 className="font-semibold">Write a review</h3>
      <ErrorMessage error={error} />
      <div>
        <p className="text-sm text-muted-foreground mb-1.5">Your rating</p>
        <StarRating value={rating} interactive onChange={v => { setRating(v); setFieldErrors(f => ({ ...f, rating: '' })) }} size="lg" />
        {fieldErrors.rating && <p className="text-sm text-destructive mt-1">{fieldErrors.rating}</p>}
      </div>
      <div>
        <Textarea placeholder="Share your experience (optional)" value={comment} onChange={(e) => { setComment(e.target.value); setFieldErrors(f => ({ ...f, comment: '' })) }} rows={3} maxLength={1000} />
        {fieldErrors.comment && <p className="text-sm text-destructive mt-1">{fieldErrors.comment}</p>}
        <MaxLengthWarning value={comment} max={1000} />
        <p className="text-xs text-muted-foreground mt-1 text-right">{comment.length}/1000</p>
      </div>
      <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Review'}</Button>
    </form>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)

  const addItem = useCartStore((s) => s.addItem)
  const inCart = useCartStore((s) => s.items.some((i) => i.product_id === Number(id)))
  const wishlisted = useWishlistStore((s) => s.items.some((i) => i.product_id === Number(id)))
  const addToWishlist = useWishlistStore((s) => s.addItem)
  const addToBackend = useWishlistStore((s) => s.addToBackend)
  const removeFromWishlist = useWishlistStore((s) => s.removeItem)
  const removeFromBackend = useWishlistStore((s) => s.removeFromBackend)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  function fetchReviews() {
    api.get(`/products/${id}/reviews/`).then(({ data }) => setReviews(data.results ?? data)).catch(() => {})
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([api.get(`/products/${id}/`), api.get(`/products/${id}/reviews/`)]).then(([p, r]) => {
      setProduct(p.data)
      setReviews(r.data.results ?? r.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6 md:gap-10">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Product not found.</p>
        <Link to="/" className="text-primary hover:underline mt-2 block">Back to products</Link>
      </div>
    )
  }

  const discountPct = parseFloat(product.discount_percentage || 0)
  const originalPrice = parseFloat(product.price)
  const effectivePrice = discountPct > 0 ? originalPrice * (1 - discountPct / 100) : originalPrice
  const isComingSoon = product.status === 'coming_soon'
  const inStock = product.stock > 0 && !isComingSoon

  async function handleAddToCart() {
    try {
      await addItem(product, quantity)
      toast.success(`${product.name} added to cart`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add to cart'))
    }
  }

  async function handleWishlist() {
    if (wishlisted) {
      try {
        isAuthenticated() ? await removeFromBackend(product.id) : removeFromWishlist(product.id)
        toast.success('Removed from wishlist')
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to remove from wishlist'))
      }
    } else {
      try {
        isAuthenticated() ? await addToBackend(product) : addToWishlist(product)
        toast.success('Added to wishlist')
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to add to wishlist'))
      }
    }
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors">Products</Link>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-6 md:gap-10">
          <ImageGallery images={product.images || []} />

          <div className="space-y-5">
            <div>
              {product.category_name && <Badge variant="secondary" className="mb-2">{product.category_name}</Badge>}
              <h1 className="text-2xl font-bold leading-snug">{product.name}</h1>
            </div>

            {product.average_rating > 0 && (
              <div className="flex items-center gap-2">
                <StarRating value={product.average_rating} size="md" />
                <span className="text-sm text-muted-foreground">
                  {parseFloat(product.average_rating).toFixed(1)} ({product.review_count} reviews)
                </span>
              </div>
            )}

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold">৳{effectivePrice.toFixed(2)}</span>
              {discountPct > 0 && (
                <>
                  <span className="text-lg text-muted-foreground line-through">৳{originalPrice.toFixed(2)}</span>
                  <Badge className="bg-destructive text-destructive-foreground">-{discountPct}%</Badge>
                </>
              )}
            </div>

            <p className={cn(
              'text-sm font-medium',
              isComingSoon ? 'text-primary' : inStock ? 'text-success' : 'text-destructive',
            )}>
              {isComingSoon ? 'Coming Soon' : inStock ? `In stock (${product.stock} available)` : 'Out of stock'}
            </p>

            {inStock && !isComingSoon && (
              <div className="flex items-center border border-border rounded-lg w-fit overflow-hidden">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-accent transition-colors">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="px-4 py-2 text-sm font-medium min-w-[2.5rem] text-center">{quantity}</span>
                <button onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} className="px-3 py-2 hover:bg-accent transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                disabled={isComingSoon || !inStock || inCart}
                onClick={handleAddToCart}
                className={cn(
                  'flex-1',
                  isComingSoon && 'bg-primary/10 text-primary hover:bg-primary/10 border border-primary/20 opacity-90 cursor-not-allowed',
                  !isComingSoon && !inStock && 'bg-muted text-muted-foreground hover:bg-muted opacity-60 cursor-not-allowed',
                  !isComingSoon && inStock && inCart && 'bg-muted text-muted-foreground hover:bg-muted opacity-60 cursor-not-allowed',
                )}
              >
                {isComingSoon
                  ? <Clock className="h-4 w-4 mr-2 shrink-0" />
                  : <ShoppingCart className="h-4 w-4 mr-2 shrink-0" />
                }
                {isComingSoon ? 'Coming Soon' : !inStock ? 'Out of Stock' : inCart ? 'Added to Cart' : 'Add to Cart'}
              </Button>
              <Button variant="outline" size="icon" onClick={handleWishlist} className={cn(wishlisted && 'text-destructive border-destructive hover:text-destructive')} aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
                <Heart className={cn('h-4 w-4', wishlisted && 'fill-current')} />
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="description" className="mt-10">
          <TabsList>
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-4">
            {product.description ? (
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
            ) : (
              <p className="text-muted-foreground italic">No description available.</p>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="mt-4">
            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reviews yet. Be the first!</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} productId={id} onChanged={fetchReviews} />
                ))}
              </div>
            )}
            {isAuthenticated() && <ReviewForm productId={id} onSubmitted={fetchReviews} reviews={reviews} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
