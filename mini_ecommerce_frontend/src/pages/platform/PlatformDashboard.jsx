import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Store, Users, ShoppingBag, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/api/axios'

const statusVariant = {
  active:    'default',
  suspended: 'secondary',
  deleted:   'destructive',
}

export default function PlatformDashboard() {
  const [stats, setStats]   = useState(null)
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, storesRes] = await Promise.all([
          api.get('/platform/stats/'),
          api.get('/platform/stores/'),
        ])
        setStats(statsRes.data)
        setStores(storesRes.data.slice(0, 5)) // latest 5
      } catch {
        setError('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map((i) => <div key={i} className="border border-border rounded-lg p-5 space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /></div>)}
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-2 text-destructive">
      <AlertCircle className="h-4 w-4" /> {error}
    </div>
  )

  const statCards = [
    { label: 'Total Stores',     value: stats.total_stores,    icon: Store,       sub: `${stats.active_stores} active` },
    { label: 'Total Customers',  value: stats.total_customers, icon: Users,       sub: 'across all stores' },
    { label: 'Total Orders',     value: stats.total_orders,    icon: ShoppingBag, sub: 'all time' },
    { label: 'Total Revenue',    value: `৳${Number(stats.total_revenue).toLocaleString()}`, icon: DollarSign, sub: 'excluding cancelled' },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Suspended stores alert */}
      {stats.suspended_stores > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {stats.suspended_stores} store{stats.suspended_stores > 1 ? 's are' : ' is'} currently suspended.
          <Link to="/platform/stores" className="underline font-medium ml-1">View stores</Link>
        </div>
      )}

      {/* Recent stores */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Stores</CardTitle>
          <Link to="/platform/stores" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <TrendingUp className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stores yet.</p>
          ) : (
            <div className="space-y-3">
              {stores.map((store) => (
                <div key={store.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <Link
                      to={`/platform/stores/${store.id}`}
                      className="text-sm font-medium hover:underline truncate block"
                    >
                      {store.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{store.owner_email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {store.order_count} orders
                    </span>
                    <Badge variant={statusVariant[store.status] || 'secondary'} className="capitalize">
                      {store.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
