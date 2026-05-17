import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, MoreHorizontal, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import TableSkeleton from '@/components/shared/TableSkeleton'
import { toast } from 'sonner'
import api from '@/api/axios'

const statusVariant = {
  active:    'default',
  suspended: 'secondary',
  deleted:   'destructive',
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

const emptyForm = {
  name: '', slug: '', owner_email: '', owner_first_name: '', owner_last_name: '',
  // Step 2 — initial settings
  support_email: '', currency: 'BDT', tax_rate: '0',
  cod_enabled: true, online_payment_enabled: true,
}

export default function StoresPage() {
  const [stores, setStores]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [form, setForm]           = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving]       = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { type, store }

  async function loadStores() {
    try {
      const { data } = await api.get('/platform/stores/')
      setStores(data)
    } catch {
      toast.error('Failed to load stores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStores() }, [])

  const filtered = stores.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.owner_email.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  )

  function handleNameChange(value) {
    setForm((f) => ({ ...f, name: value, slug: slugify(value) }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setFormErrors({})
    try {
      await api.post('/platform/stores/', form)
      toast.success(`Store "${form.name}" created. Invite email sent to ${form.owner_email}.`)
      setCreateOpen(false)
      setForm(emptyForm)
      loadStores()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') setFormErrors(data)
      else toast.error('Failed to create store.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusAction(store, action) {
    try {
      await api.post(`/platform/stores/${store.id}/${action}/`)
      toast.success(`Store ${action}d.`)
      loadStores()
    } catch {
      toast.error(`Failed to ${action} store.`)
    }
  }

  async function handleDelete(store) {
    try {
      await api.delete(`/platform/stores/${store.id}/`)
      toast.success(`Store "${store.name}" deleted.`)
      loadStores()
    } catch {
      toast.error('Failed to delete store.')
    }
  }

  async function handleResendInvite(store) {
    try {
      await api.post(`/platform/stores/${store.id}/resend-invite/`)
      toast.success(`Invitation email sent to ${store.owner_email}.`)
    } catch {
      toast.error('Failed to send invitation email.')
    }
  }

  if (loading) return <div className="p-6"><TableSkeleton cols={5} /></div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { setForm(emptyForm); setFormErrors({}); setWizardStep(1); setCreateOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> New Store
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      No stores found.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      <Link to={`/platform/stores/${store.id}`} className="font-medium hover:underline">
                        {store.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{store.slug}</p>
                    </TableCell>
                    <TableCell className="text-sm">{store.owner_email}</TableCell>
                    <TableCell className="text-right text-sm">{store.customer_count}</TableCell>
                    <TableCell className="text-right text-sm">{store.order_count}</TableCell>
                    <TableCell className="text-right text-sm">৳{Number(store.revenue).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[store.status] || 'secondary'} className="capitalize">
                        {store.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.location.href = `/platform/stores/${store.id}`}>View details</DropdownMenuItem>
                          {store.status !== 'deleted' && (
                            <DropdownMenuItem onClick={() => handleResendInvite(store)}>
                              Send invitation
                            </DropdownMenuItem>
                          )}
                          {store.status === 'active' && (
                            <DropdownMenuItem
                              className="text-yellow-600"
                              onClick={() => setConfirmAction({ type: 'suspend', store })}
                            >
                              Suspend
                            </DropdownMenuItem>
                          )}
                          {store.status === 'suspended' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusAction(store, 'activate')}
                            >
                              Activate
                            </DropdownMenuItem>
                          )}
                          {store.status !== 'deleted' && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setConfirmAction({ type: 'delete', store })}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create store wizard dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setWizardStep(1) } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Create New Store
              <span className="ml-2 text-sm font-normal text-muted-foreground">Step {wizardStep} of 2</span>
            </DialogTitle>
          </DialogHeader>

          {/* Step 1 — Store identity + owner */}
          {wizardStep === 1 && (
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="store-name">Store Name *</Label>
                <Input
                  id="store-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="My Awesome Store"
                />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="store-slug">Slug *</Label>
                <Input
                  id="store-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="my-awesome-store"
                />
                <p className="text-xs text-muted-foreground">Subdomain: {form.slug || 'your-slug'}.yourdomain.com</p>
                {formErrors.slug && <p className="text-xs text-destructive">{formErrors.slug}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner-email">Owner Email *</Label>
                <Input
                  id="owner-email"
                  type="email"
                  value={form.owner_email}
                  onChange={(e) => setForm((f) => ({ ...f, owner_email: e.target.value }))}
                  placeholder="owner@example.com"
                />
                {formErrors.owner_email && <p className="text-xs text-destructive">{formErrors.owner_email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="owner-first">First Name</Label>
                  <Input
                    id="owner-first"
                    value={form.owner_first_name}
                    onChange={(e) => setForm((f) => ({ ...f, owner_first_name: e.target.value }))}
                    placeholder="Jane"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-last">Last Name</Label>
                  <Input
                    id="owner-last"
                    value={form.owner_last_name}
                    onChange={(e) => setForm((f) => ({ ...f, owner_last_name: e.target.value }))}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  disabled={!form.name || !form.slug || !form.owner_email}
                  onClick={() => setWizardStep(2)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2 — Initial store settings */}
          {wizardStep === 2 && (
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    placeholder="BDT"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.tax_rate}
                    onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support-email">Support Email</Label>
                <Input
                  id="support-email"
                  type="email"
                  value={form.support_email}
                  onChange={(e) => setForm((f) => ({ ...f, support_email: e.target.value }))}
                  placeholder="support@mystore.com"
                />
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Payment Methods</p>
                <div className="flex items-center justify-between">
                  <Label htmlFor="cod" className="text-sm font-normal">Cash on Delivery</Label>
                  <Switch
                    id="cod"
                    checked={form.cod_enabled}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, cod_enabled: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="online-pay" className="text-sm font-normal">Online Payment</Label>
                  <Switch
                    id="online-pay"
                    checked={form.online_payment_enabled}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, online_payment_enabled: v }))}
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                An invite email will be sent to the owner to set their password.
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setWizardStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Store'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm suspend / delete */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'delete' ? 'Delete store?' : 'Suspend store?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'delete'
                ? `"${confirmAction?.store?.name}" will be soft-deleted. This action cannot be undone from the UI.`
                : `"${confirmAction?.store?.name}" will be suspended. Customers will not be able to access it.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.type === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
              onClick={() => {
                if (confirmAction?.type === 'delete') handleDelete(confirmAction.store)
                else handleStatusAction(confirmAction.store, 'suspend')
                setConfirmAction(null)
              }}
            >
              {confirmAction?.type === 'delete' ? 'Delete' : 'Suspend'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
