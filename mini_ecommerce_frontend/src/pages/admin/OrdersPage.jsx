import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, X, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Pagination from '@/components/shared/Pagination'
import TableSkeleton from '@/components/shared/TableSkeleton'
import api from '@/api/axios'

const ORDER_STATUSES = ['Pending', 'In-Progress', 'Delivered', 'Cancelled']

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'In-Progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Delivered: 'bg-success/10 text-success',
  Cancelled: 'bg-destructive/10 text-destructive',
  Returned: 'bg-muted text-muted-foreground',
}

const PAYMENT_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
}

function OrderDetailModal({ selectedOrder, onClose }) {
  const [order, setOrder] = useState(null)
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedOrder) return
    setLoading(true)
    Promise.all([
      api.get(`/orders/${selectedOrder.public_id}/`),
      api.get(`/admin/payments/?order_id=${selectedOrder.id}`),
    ])
      .then(([orderRes, paymentRes]) => {
        setOrder(orderRes.data)
        const payments = paymentRes.data.results ?? paymentRes.data
        setPayment(payments[0] ?? null)
      })
      .catch(() => toast.error('Failed to load order details.'))
      .finally(() => setLoading(false))
  }, [selectedOrder])

  return (
    <Dialog open={!!selectedOrder} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order #{selectedOrder?.id}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-4"><TableSkeleton cols={3} rows={4} /></div>
        ) : !order ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Failed to load order.</p>
        ) : (
          <div className="space-y-6 text-sm">

            {/* Customer */}
            <section className="space-y-1">
              <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Customer</h3>
              <p className="font-medium">{order.user_email || '—'}</p>
              <p className="text-muted-foreground text-xs">
                Placed {new Date(order.created_at).toLocaleString()}
              </p>
            </section>

            {/* Order Items */}
            <section className="space-y-2">
              <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Items</h3>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right w-20">Qty</TableHead>
                      <TableHead className="text-right w-28">Unit Price</TableHead>
                      <TableHead className="text-right w-28">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.product_image ? (
                              <img src={item.product_image} alt={item.product_name} className="h-8 w-8 rounded object-cover shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-medium">{item.product_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">৳{parseFloat(item.price_at_purchase).toFixed(2)}</TableCell>
                        <TableCell className="text-right">৳{(item.quantity * parseFloat(item.price_at_purchase)).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* Totals */}
            <section className="space-y-1.5 border-t border-border pt-3">
              {order.applied_coupon && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Coupon <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{order.applied_coupon.code}</span></span>
                  <span>−৳{parseFloat(order.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>৳{parseFloat(order.total_amount).toFixed(2)}</span>
              </div>
            </section>

            {/* Shipping Address */}
            <section className="space-y-1">
              <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Shipping Address</h3>
              <p className="text-muted-foreground whitespace-pre-line">{order.shipping_address || '—'}</p>
            </section>

            {/* Payment */}
            <section className="space-y-2">
              <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Payment</h3>
              {payment ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[payment.status] || 'bg-muted text-muted-foreground'}`}>
                    {payment.status}
                  </span>
                  <span className="text-muted-foreground">Method</span>
                  <span className="capitalize">{payment.payment_method || '—'}</span>
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono text-xs break-all">{payment.transaction_id || '—'}</span>
                  <span className="text-muted-foreground">Amount</span>
                  <span>৳{parseFloat(payment.amount).toFixed(2)}</span>
                </div>
              ) : (
                <p className="text-muted-foreground">No payment record found.</p>
              )}
            </section>

          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [detailOrder, setDetailOrder] = useState(null)

  const statusFilter = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')

  function setParam(key, value) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      value ? next.set(key, value) : next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (statusFilter) q.set('status', statusFilter)
      if (page > 1) q.set('page', page)
      const { data } = await api.get(`/orders/?${q}`)
      setOrders(data.results)
      setCount(data.count)
    } catch { setOrders([]) }
    finally { setLoading(false) }
  }, [searchParams])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function handleStatusChange(order, newStatus) {
    try {
      await api.patch(`/orders/${order.public_id}/`, { status: newStatus })
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
      toast.success('Status updated.')
    } catch { toast.error('Failed to update status.') }
  }

  async function handleBulkUpdate() {
    if (!selected.size || !bulkStatus) return
    setBulkLoading(true)
    try {
      await api.post('/admin/orders/bulk-update/', { order_ids: [...selected], status: bulkStatus })
      toast.success('Bulk update applied.')
      setSelected(new Set())
      setBulkStatus('')
      fetchOrders()
    } catch { toast.error('Bulk update failed.') }
    finally { setBulkLoading(false) }
  }

  async function handleExport() {
    try {
      const q = statusFilter ? `?status=${statusFilter}` : ''
      const res = await api.get(`/admin/orders/export/${q}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = 'orders.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Export failed.') }
  }

  const allSelected = orders.length > 0 && orders.every(o => selected.has(o.id))

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter || 'all'} onValueChange={v => setParam('status', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {[...ORDER_STATUSES, 'Return-Requested', 'Return-Approved', 'Returned'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm flex-wrap">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="h-7 w-full sm:w-36 text-xs"><SelectValue placeholder="Set status" /></SelectTrigger>
            <SelectContent>{ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" disabled={!bulkStatus || bulkLoading} onClick={handleBulkUpdate} className="h-7 text-xs">Apply</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? <TableSkeleton cols={6} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(orders.map(o => o.id)))} /></TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden sm:table-cell">Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No orders found.</TableCell></TableRow>
                ) : orders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell><Checkbox checked={selected.has(o.id)} onCheckedChange={v => setSelected(s => { const n = new Set(s); v ? n.add(o.id) : n.delete(o.id); return n })} /></TableCell>
                    <TableCell>
                      <button
                        onClick={() => setDetailOrder(o)}
                        className="font-medium text-sm text-primary hover:underline"
                      >
                        #{o.id}
                      </button>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{o.user_email || o.user || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm font-medium">৳{parseFloat(o.total_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={v => handleStatusChange(o, v)}>
                        <SelectTrigger className={`h-7 w-28 sm:w-36 text-xs border-0 ${STATUS_COLORS[o.status] || ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>{ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination count={count} page={page} onPageChange={p => setParam('page', String(p))} />
        </>
      )}

      <OrderDetailModal
        selectedOrder={detailOrder}
        onClose={() => setDetailOrder(null)}
      />
    </div>
  )
}
