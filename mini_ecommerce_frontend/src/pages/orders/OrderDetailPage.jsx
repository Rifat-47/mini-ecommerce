import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download, RotateCcw, Loader2, Eye, ZoomIn, ZoomOut, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import ErrorMessage from '@/components/shared/ErrorMessage'
import MaxLengthWarning from '@/components/shared/MaxLengthWarning'
import api from '@/api/axios'

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'In-Progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Delivered: 'bg-success/10 text-success',
  Cancelled: 'bg-destructive/10 text-destructive',
  Returned: 'bg-muted text-muted-foreground',
  'Return-Requested': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'Return-Approved': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

const PAYMENT_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
}

const RETURN_STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
}

function ReturnForm({ orderId, onSubmitted }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState('')
  const [open, setOpen] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) { setFieldError('Please provide a reason.'); return }
    if (reason.trim().length < 10) { setFieldError('Reason must be at least 10 characters.'); return }
    if (reason.length > 1000) { setFieldError('Reason must be at most 1000 characters.'); return }
    setFieldError('')
    setError(null)
    setLoading(true)
    try {
      await api.post(`/orders/${orderId}/return/`, { reason })
      toast.success('Return request submitted.')
      setOpen(false)
      onSubmitted?.()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to submit return request.' })
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Request Return
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 p-4 border border-border rounded-lg bg-muted/30 mt-4">
      <h3 className="font-medium text-sm">Return Request</h3>
      <ErrorMessage error={error} />
      <div>
        <Textarea
          placeholder="Describe the reason for return (min 10 characters)..."
          value={reason}
          onChange={(e) => { setReason(e.target.value); setFieldError('') }}
          rows={3}
          maxLength={1000}
        />
        {fieldError && <p className="text-sm text-destructive mt-1">{fieldError}</p>}
        <MaxLengthWarning value={reason} max={1000} />
        <p className="text-xs text-muted-foreground mt-1 text-right">{reason.length}/1000</p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
          Submit
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [payment, setPayment] = useState(null)
  const [returnInfo, setReturnInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initiatingPayment, setInitiatingPayment] = useState(false)
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)
  const [viewingInvoice, setViewingInvoice] = useState(false)
  const [invoiceBlobUrl, setInvoiceBlobUrl] = useState(null)
  const [zoom, setZoom] = useState(1)

  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 2
  const ZOOM_STEP = 0.25

  function fetchOrder() {
    setLoading(true)
    Promise.all([
      api.get(`/orders/${id}/`),
      api.get(`/payments/order/${id}/`).catch(() => ({ data: null })),
      api.get(`/orders/${id}/return/`).catch(() => ({ data: [] })),
    ]).then(([orderRes, payRes, returnRes]) => {
      setOrder(orderRes.data)
      setPayment(payRes.data)
      // [] means no return request exists; an object means one exists
      setReturnInfo(Array.isArray(returnRes.data) ? null : returnRes.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrder() }, [id])

  // When the order is already Return-Approved but returnInfo still shows pending,
  // it means the page loaded stale data — re-fetch returnInfo immediately.
  useEffect(() => {
    if (order?.status === 'Return-Approved' && returnInfo?.status === 'pending') {
      api.get(`/orders/${id}/return/`)
        .then(({ data }) => setReturnInfo(Array.isArray(data) ? null : data))
        .catch(() => {})
    }
  }, [order?.status, returnInfo?.status, id])

  async function handlePay() {
    setInitiatingPayment(true)
    try {
      const { data } = await api.post('/payments/initiate/', { order_id: id })
      window.location.href = data.checkout_url
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate payment.')
      setInitiatingPayment(false)
    }
  }

  async function handleInvoiceDownload() {
    setDownloadingInvoice(true)
    try {
      const res = await api.get(`/orders/${id}/invoice/`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-order-${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download invoice.')
    } finally {
      setDownloadingInvoice(false)
    }
  }

  async function handleInvoiceView() {
    setViewingInvoice(true)
    try {
      const res = await api.get(`/orders/${id}/invoice/`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      setInvoiceBlobUrl(url)
    } catch {
      toast.error('Failed to load invoice.')
      setViewingInvoice(false)
    }
  }

  function handleCloseInvoice() {
    if (invoiceBlobUrl) URL.revokeObjectURL(invoiceBlobUrl)
    setInvoiceBlobUrl(null)
    setViewingInvoice(false)
    setZoom(1)
  }

  if (loading) {
    return (
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Order not found.</p>
        <Link to="/orders" className="text-primary hover:underline mt-2 block">Back to orders</Link>
      </div>
    )
  }

  const isDelivered = order.status === 'Delivered'
  const canReturn = isDelivered && !returnInfo
  const orderDate = new Date(order.created_at)
  const returnWindowDays = 7
  const daysSinceDelivery = isDelivered
    ? Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const withinReturnWindow = daysSinceDelivery !== null && daysSinceDelivery <= returnWindowDays

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {/* Back */}
      <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to orders
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Order #{order.id}</h1>
          <p className="text-sm text-muted-foreground">
            Placed on {orderDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>
            {order.status}
          </span>
          {order.status === 'Pending' && payment?.status !== 'completed' && (
            <Button size="sm" onClick={handlePay} disabled={initiatingPayment}>
              {initiatingPayment
                ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                : <CreditCard className="h-4 w-4 mr-1.5" />}
              Pay Now
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleInvoiceView} disabled={viewingInvoice}>
            {viewingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={handleInvoiceDownload} disabled={downloadingInvoice}>
            {downloadingInvoice ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            Invoice
          </Button>
        </div>
      </div>

      {/* Invoice viewer modal */}
      <Dialog open={!!invoiceBlobUrl} onOpenChange={(open) => { if (!open) handleCloseInvoice() }}>
        <DialogContent className="max-w-[98vw] sm:max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="font-semibold text-sm">Invoice — Order #{id}</span>
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setZoom((z) => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))}
                disabled={zoom <= ZOOM_MIN}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
                disabled={zoom >= ZOOM_MAX}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

              <div className="w-px h-5 bg-border mx-1" />

              <Button variant="outline" size="sm" onClick={handleInvoiceDownload} disabled={downloadingInvoice}>
                {downloadingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                Download
              </Button>
            </div>
          </div>

          {/* Scrollable PDF area */}
          <div className="flex-1 overflow-auto bg-muted/20">
            {/*
              Outer div sized to zoom * 100% so the scroll container tracks the visual size.
              iframe sized to (1/zoom) * 100% of outer div = 100% of scroll container,
              then scaled back up — net visual size equals the outer div. Math:
                visual_width  = (1/zoom * outerW) * zoom = outerW = zoom * containerW ✓
                visual_height = (1/zoom * outerH) * zoom = outerH = zoom * containerH ✓
              For zoom < 1 outer div is smaller than container, minHeight keeps it full.
            */}
            <div
              style={{
                width: `${zoom * 100}%`,
                height: `${zoom * 100}%`,
                minHeight: '100%',
              }}
            >
              <iframe
                src={invoiceBlobUrl}
                style={{
                  display: 'block',
                  border: 'none',
                  width: `${(1 / zoom) * 100}%`,
                  height: `${(1 / zoom) * 100}%`,
                  minHeight: `${(1 / zoom) * 100}%`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
                title={`Invoice for order ${id}`}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Items */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Items</h2>
        </div>
        <div className="divide-y divide-border">
          {order.items?.map((item) => (
            <div key={item.id} className="flex gap-4 p-4">
              <Link to={`/products/${item.product}`} className="shrink-0">
                <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden">
                  {item.product_image ? (
                    <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No img</div>
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/products/${item.product}`} className="font-medium text-sm hover:underline line-clamp-1">
                  {item.product_name}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ৳{(parseFloat(item.price_at_purchase) / item.quantity).toFixed(2)} × {item.quantity}
                </p>
              </div>
              <div className="shrink-0 font-semibold text-sm">
                ৳{parseFloat(item.price_at_purchase).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="px-4 py-3 border-t border-border bg-muted/30 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>৳{(parseFloat(order.total_amount) + parseFloat(order.discount_amount || 0)).toFixed(2)}</span>
          </div>
          {order.applied_coupon && parseFloat(order.discount_amount) > 0 && (
            <div className="flex justify-between text-success">
              <span>Discount (coupon: {order.applied_coupon.code})</span>
              <span>-৳{parseFloat(order.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>৳{parseFloat(order.total_amount).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment status */}
      {payment && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-sm mb-3">Payment</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[payment.status] || 'bg-muted text-muted-foreground'}`}>
                {payment.status}
              </span>
            </div>
            {payment.transaction_id && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Transaction ID</p>
                <p className="font-medium">{payment.transaction_id}</p>
              </div>
            )}
            {payment.payment_method && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Method</p>
                <p className="font-medium capitalize">{payment.payment_method}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Amount</p>
              <p className="font-medium">৳{parseFloat(payment.amount).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Shipping address */}
      {order.shipping_address && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-sm mb-2">Shipping Address</h2>
          <p className="text-sm text-muted-foreground">{order.shipping_address}</p>
        </div>
      )}

      {/* Return section */}
      {returnInfo && (
        <div className={`border rounded-xl p-4 mb-6 ${returnInfo.status === 'rejected' ? 'bg-destructive/5 border-destructive/30' : returnInfo.status === 'approved' ? 'bg-success/5 border-success/30' : 'bg-card border-border'}`}>
          <h2 className="font-semibold text-sm mb-3">Return Request</h2>
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RETURN_STATUS_COLORS[returnInfo.status] || 'bg-muted text-muted-foreground'}`}>
                {returnInfo.status.charAt(0).toUpperCase() + returnInfo.status.slice(1)}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground">Reason: </span>
              <span>{returnInfo.reason}</span>
            </div>

            {returnInfo.status === 'rejected' && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
                <p className="font-medium text-destructive text-xs uppercase tracking-wide">Return Request Rejected</p>
                <p className="text-muted-foreground text-xs">Your return request has been reviewed and rejected. If you have questions, please contact support.</p>
                {returnInfo.admin_note && (
                  <p className="text-sm mt-1"><span className="text-muted-foreground">Admin note: </span>{returnInfo.admin_note}</p>
                )}
              </div>
            )}

            {returnInfo.status !== 'rejected' && returnInfo.admin_note && (
              <div>
                <span className="text-muted-foreground">Admin note: </span>
                <span>{returnInfo.admin_note}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {canReturn && withinReturnWindow && (
        <ReturnForm orderId={id} onSubmitted={fetchOrder} />
      )}
    </div>
  )
}
