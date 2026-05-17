import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Package, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Pagination from '@/components/shared/Pagination'
import EmptyState from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
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

const STATUS_OPTIONS = ['All', 'Pending', 'In-Progress', 'Delivered', 'Cancelled', 'Return-Requested', 'Return-Approved', 'Returned']

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')

  function setParam(key, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      value ? next.set(key, value) : next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (status) query.set('status', status)
      if (page > 1) query.set('page', page)
      const { data } = await api.get(`/orders/?${query}`)
      setOrders(data.results)
      setCount(data.count)
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <Select
          value={status || 'all'}
          onValueChange={(v) => setParam('status', v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s === 'All' ? 'all' : s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between bg-card border border-border rounded-xl p-4 gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-20 shrink-0" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          message={status ? 'No orders match this filter.' : 'Place your first order to see it here.'}
          action={status ? { label: 'Clear filter', onClick: () => setParam('status', '') } : undefined}
        />
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.public_id}
                to={`/orders/${order.public_id}`}
                className="flex items-center justify-between bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">Order #{order.id}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    {' · '}
                    {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-sm">৳{parseFloat(order.total_amount).toFixed(2)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>

          <Pagination
            count={count}
            page={page}
            onPageChange={(p) => setParam('page', String(p))}
          />
        </>
      )}
    </div>
  )
}
