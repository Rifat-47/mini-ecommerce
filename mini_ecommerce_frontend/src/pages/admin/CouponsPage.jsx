import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ErrorMessage from '@/components/shared/ErrorMessage'
import MaxLengthWarning from '@/components/shared/MaxLengthWarning'
import Pagination from '@/components/shared/Pagination'
import TableSkeleton from '@/components/shared/TableSkeleton'
import useUnsavedChanges from '@/hooks/useUnsavedChanges.jsx'
import api from '@/api/axios'

const EMPTY = {
  code: '', discount_type: 'percentage', discount_value: '', expiry_date: '',
  usage_limit: '', per_user_limit: '', is_active: true, min_order_value: '',
  max_discount_amount: '', first_time_only: false,
  applicable_categories: [], user: '',
}

function CouponForm({ initial, onSave, onClose, markDirty, confirmClose }) {
  const [form, setForm] = useState(initial ? {
    code: initial.code || '',
    discount_type: initial.discount_type || 'percentage',
    discount_value: initial.discount_value || '',
    expiry_date: initial.expiry_date || '',
    usage_limit: initial.usage_limit ?? '',
    per_user_limit: initial.per_user_limit ?? '',
    is_active: initial.is_active ?? true,
    min_order_value: initial.min_order_value || '',
    max_discount_amount: initial.max_discount_amount || '',
    first_time_only: initial.first_time_only || false,
    applicable_categories: initial.applicable_categories || [],
    user: initial.user ?? '',
  } : EMPTY)
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    api.get('/categories/?all=true').then(({ data }) => setCategories(data.results ?? data)).catch(() => {})
    api.get('/admin/users/?page_size=500').then(({ data }) => setUsers(data.results ?? data)).catch(() => {})
  }, [])

  function field(key) {
    return (e) => { setForm(f => ({ ...f, [key]: e.target.value })); markDirty() }
  }

  function toggleCategory(id) {
    setForm(f => ({
      ...f,
      applicable_categories: f.applicable_categories.includes(id)
        ? f.applicable_categories.filter(c => c !== id)
        : [...f.applicable_categories, id],
    }))
    markDirty()
  }

  function validate() {
    const errors = {}
    if (!form.code.trim()) errors.code = 'Code is required.'
    else if (form.code.trim().length < 3) errors.code = 'Code must be at least 3 characters.'
    else if (form.code.length > 50) errors.code = 'Code must be at most 50 characters.'
    if (!String(form.discount_value).trim()) errors.discount_value = 'Discount value is required.'
    else if (isNaN(form.discount_value) || Number(form.discount_value) < 0) errors.discount_value = 'Enter a valid positive number.'
    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const errors = validate()
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})
    setSaving(true)
    try {
      const payload = { ...form }
      // convert empty strings to null for optional numeric/FK fields
      ;['usage_limit', 'per_user_limit', 'min_order_value', 'max_discount_amount', 'user'].forEach(k => {
        if (payload[k] === '') payload[k] = null
      })
      initial?.id ? await api.patch(`/admin/coupons/${initial.id}/`, payload) : await api.post('/admin/coupons/', payload)
      toast.success(initial?.id ? 'Coupon updated.' : 'Coupon created.')
      onSave()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to save coupon.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <ErrorMessage error={error} />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Code <span className="text-destructive">*</span></Label>
            <Input value={form.code} onChange={e => { field('code')(e); setFieldErrors(f => ({ ...f, code: '' })) }} maxLength={50} placeholder="SAVE10" className="uppercase" />
            {fieldErrors.code && <p className="text-sm text-destructive mt-1">{fieldErrors.code}</p>}
            <MaxLengthWarning value={form.code} max={50} />
          </div>
          <div className="space-y-1.5">
            <Label>Discount type <span className="text-destructive">*</span></Label>
            <Select value={form.discount_type} onValueChange={v => { setForm(f => ({ ...f, discount_type: v })); markDirty() }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed (৳)</SelectItem>
                <SelectItem value="free_shipping">Free Shipping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Discount value <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.01" min="0" value={form.discount_value} onChange={e => { field('discount_value')(e); setFieldErrors(f => ({ ...f, discount_value: '' })) }} />
            {fieldErrors.discount_value && <p className="text-sm text-destructive mt-1">{fieldErrors.discount_value}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Expiry date</Label>
            <Input type="date" value={form.expiry_date} onChange={field('expiry_date')} />
          </div>
          <div className="space-y-1.5">
            <Label>Min order value (৳)</Label>
            <Input type="number" step="0.01" min="0" value={form.min_order_value} onChange={field('min_order_value')} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Max discount (৳)</Label>
            <Input type="number" step="0.01" min="0" value={form.max_discount_amount} onChange={field('max_discount_amount')} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Usage limit</Label>
            <Input type="number" min="1" value={form.usage_limit} onChange={field('usage_limit')} placeholder="Unlimited" />
          </div>
          <div className="space-y-1.5">
            <Label>Per user limit</Label>
            <Input type="number" min="1" value={form.per_user_limit} onChange={field('per_user_limit')} placeholder="Unlimited" />
          </div>
          <div className="col-span-2 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="is_active" checked={form.is_active} onCheckedChange={v => { setForm(f => ({ ...f, is_active: v })); markDirty() }} />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="first_time" checked={form.first_time_only} onCheckedChange={v => { setForm(f => ({ ...f, first_time_only: v })); markDirty() }} />
              <Label htmlFor="first_time">First-time only</Label>
            </div>
          </div>
          {categories.length > 0 && (
            <div className="col-span-2 space-y-1.5">
              <Label>Applicable categories <span className="text-muted-foreground font-normal">(leave empty to apply to all)</span></Label>
              <div className="flex flex-wrap gap-2 rounded-md border border-border p-2 max-h-32 overflow-y-auto">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                      form.applicable_categories.includes(cat.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:border-primary'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="col-span-2 space-y-1.5">
            <Label>Assign to user <span className="text-muted-foreground font-normal">(leave empty for public coupon)</span></Label>
            <select
              value={form.user ?? ''}
              onChange={field('user')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Public coupon —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => confirmClose(onClose)}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{initial?.id ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export default function CouponsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [coupons, setCoupons] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editCoupon, setEditCoupon] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const { markDirty, confirmClose, DiscardDialog, reset } = useUnsavedChanges()

  const page = parseInt(searchParams.get('page') || '1')

  function setParam(key, value) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      value ? next.set(key, value) : next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (page > 1) q.set('page', page)
      const { data } = await api.get(`/admin/coupons/?${q}`)
      setCoupons(data.results ?? data)
      setCount(data.count ?? (data.results ?? data).length)
    } catch { setCoupons([]) }
    finally { setLoading(false) }
  }, [searchParams])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  async function handleDelete() {
    try {
      await api.delete(`/admin/coupons/${deleteId}/`)
      toast.success('Coupon deleted.')
      setDeleteId(null)
      fetchCoupons()
    } catch { toast.error('Failed to delete.') }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Coupons</h1>
        <Button size="sm" onClick={() => { reset(); setEditCoupon(null); setShowForm(true) }}><Plus className="h-4 w-4 mr-1.5" />Add Coupon</Button>
      </div>

      {loading ? <TableSkeleton cols={6} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="hidden md:table-cell">Expiry</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No coupons found.</TableCell></TableRow>
                ) : coupons.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium text-sm">{c.code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">{c.discount_type.replace('_', ' ')}</TableCell>
                    <TableCell className="text-sm">{c.discount_type === 'percentage' ? `${c.discount_value}%` : c.discount_type === 'fixed' ? `৳${c.discount_value}` : 'Free'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.expiry_date || '—'}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { reset(); setEditCoupon(c); setShowForm(true) }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination count={count} page={page} onPageChange={p => setParam('page', String(p))} />
        </>
      )}

      <DiscardDialog />
      <Dialog open={showForm} onOpenChange={o => { if (!o) confirmClose(() => { setShowForm(false); setEditCoupon(null) }) }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle>{editCoupon ? 'Edit Coupon' : 'Add Coupon'}</DialogTitle></DialogHeader>
          <CouponForm initial={editCoupon} onSave={() => { setShowForm(false); setEditCoupon(null); fetchCoupons() }} onClose={() => { setShowForm(false); setEditCoupon(null) }} markDirty={markDirty} confirmClose={confirmClose} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the coupon.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
