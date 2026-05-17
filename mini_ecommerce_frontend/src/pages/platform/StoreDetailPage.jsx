import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Store, Users, ShoppingBag, DollarSign, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import api from '@/api/axios'

const statusVariant = { active: 'default', suspended: 'secondary', deleted: 'destructive' }

export default function StoreDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [store, setStore]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [editName, setEditName] = useState('')
  const [editDomain, setEditDomain] = useState('')
  const [saving, setSaving]     = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  async function loadStore() {
    try {
      const { data } = await api.get(`/platform/stores/${id}/`)
      setStore(data)
      setEditName(data.name)
      setEditDomain(data.custom_domain || '')
    } catch {
      toast.error('Store not found.')
      navigate('/platform/stores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStore() }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch(`/platform/stores/${id}/`, { name: editName, custom_domain: editDomain })
      toast.success('Store updated.')
      loadStore()
    } catch {
      toast.error('Failed to update store.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusAction(action) {
    try {
      await api.post(`/platform/stores/${id}/${action}/`)
      toast.success(`Store ${action}d.`)
      loadStore()
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action} store.`)
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/platform/stores/${id}/`)
      toast.success('Store deleted.')
      navigate('/platform/stores')
    } catch {
      toast.error('Failed to delete store.')
    }
  }

  if (loading) return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex gap-3 items-center"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-7 w-48" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[1,2,3].map((i) => <div key={i} className="border border-border rounded-lg p-5 space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-7 w-14" /></div>)}</div>
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  )
  if (!store)  return null

  const statCards = [
    { label: 'Customers', value: store.customer_count ?? '—', icon: Users },
    { label: 'Orders',    value: store.order_count    ?? '—', icon: ShoppingBag },
    { label: 'Revenue',   value: store.revenue != null ? `৳${Number(store.revenue).toLocaleString()}` : '—', icon: DollarSign },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/platform/stores')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold truncate">{store.name}</h2>
            <Badge variant={statusVariant[store.status] || 'secondary'} className="capitalize">
              {store.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{store.slug}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {store.status === 'active' && (
            <Button variant="outline" size="sm" className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
              onClick={() => setConfirmAction('suspend')}>
              Suspend
            </Button>
          )}
          {store.status === 'suspended' && (
            <Button variant="outline" size="sm" onClick={() => handleStatusAction('activate')}>
              Activate
            </Button>
          )}
          {store.status !== 'deleted' && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmAction('delete')}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit store */}
      <Card>
        <CardHeader><CardTitle className="text-base">Store Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Store Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={store.slug} disabled className="opacity-60" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Custom Domain</Label>
            <Input
              value={editDomain}
              onChange={(e) => setEditDomain(e.target.value)}
              placeholder="shop.yourbrand.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Input value={store.owner_email} disabled className="opacity-60" />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader><CardTitle className="text-base">Staff Members</CardTitle></CardHeader>
        <CardContent>
          {store.memberships?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff members.</p>
          ) : (
            <div className="space-y-3">
              {store.memberships?.map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{m.email}</p>
                    {(m.first_name || m.last_name) && (
                      <p className="text-xs text-muted-foreground">{m.first_name} {m.last_name}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {m.role.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings preview */}
      {store.settings && (
        <Card>
          <CardHeader><CardTitle className="text-base">Store Settings</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              {[
                ['Currency',          store.settings.currency],
                ['Tax Rate',          `${store.settings.tax_rate}%`],
                ['Return Window',     `${store.settings.return_window_days} days`],
                ['COD',               store.settings.cod_enabled ? 'Enabled' : 'Disabled'],
                ['Online Payment',    store.settings.online_payment_enabled ? 'Enabled' : 'Disabled'],
                ['Registrations',     store.settings.registration_enabled ? 'Open' : 'Closed'],
              ].map(([key, val]) => (
                <div key={key}>
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="font-medium">{val}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Confirm dialogs */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'delete' ? 'Delete store?' : 'Suspend store?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'delete'
                ? `"${store.name}" will be soft-deleted. This cannot be undone from the UI.`
                : `"${store.name}" will be suspended. Customers will not be able to access it.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
              onClick={() => {
                if (confirmAction === 'delete') handleDelete()
                else handleStatusAction('suspend')
                setConfirmAction(null)
              }}
            >
              {confirmAction === 'delete' ? 'Delete' : 'Suspend'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
