import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Users, DollarSign, TrendingUp, Home } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import api from '@/api/axios'

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'In-Progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Delivered: 'bg-success/10 text-success',
  Cancelled: 'bg-destructive/10 text-destructive',
  Returned: 'bg-muted text-muted-foreground',
}

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          {loading ? <Skeleton className="h-6 w-20" /> : <p className="text-xl font-bold truncate">{value}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats/?top=5').then(({ data }) => setStats(data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const overview = stats?.overview || {}
  const ordersByStatus = stats?.orders_by_status || []
  const topProducts = stats?.top_products || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}><Home className="h-4 w-4 mr-2" />Back to Store</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Revenue" value={`৳${parseFloat(overview.total_revenue || 0).toLocaleString()}`} loading={loading} />
        <StatCard icon={ShoppingBag} label="Total Orders" value={overview.total_orders ?? 0} loading={loading} />
        <StatCard icon={Users} label="Total Customers" value={overview.total_customers ?? 0} loading={loading} />
        <StatCard icon={TrendingUp} label="New Today" value={overview.new_users_today ?? 0} loading={loading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Orders by Status</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : ordersByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <div className="space-y-2">
                {ordersByStatus.map(({ status, count }) => (
                  <div key={status} className="flex items-center justify-between py-1.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>
                    <span className="font-semibold text-sm">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top Products</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <div className="divide-y divide-border">
                {topProducts.map((p, i) => (
                  <div key={p.id || i} className="flex items-center justify-between py-2 gap-3">
                    <span className="text-sm truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{p.total_sold ?? p.orders_count ?? 0} sold</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
