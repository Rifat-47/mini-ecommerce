import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ErrorMessage from '@/components/shared/ErrorMessage'
import Pagination from '@/components/shared/Pagination'
import TableSkeleton from '@/components/shared/TableSkeleton'
import api from '@/api/axios'

const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'cancelled']

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
}

function PaymentEditModal({ payment, onSave, onClose }) {
  const [form, setForm] = useState({
    status: payment.status,
    payment_method: payment.payment_method || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.patch(`/admin/payments/${payment.id}/`, form)
      toast.success('Payment updated.')
      onSave()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to update payment.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorMessage error={error} />
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUSES.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Payment Method</Label>
        <Input
          value={form.payment_method}
          onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
          placeholder="e.g. cash_on_delivery, card, bkash"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [payments, setPayments] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editPayment, setEditPayment] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (statusFilter) q.set('status', statusFilter)
      if (page > 1) q.set('page', page)
      const { data } = await api.get(`/admin/payments/?${q}`)
      setPayments(data.results ?? data)
      setCount(data.count ?? (data.results ?? data).length)
    } catch { setPayments([]) }
    finally { setLoading(false) }
  }, [searchParams])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/admin/payments/${deleteId}/`)
      toast.success('Payment deleted.')
      setDeleteId(null)
      fetchPayments()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete payment.')
    } finally {
      setDeleting(false)
    }
  }

  const deleteTarget = payments.find(p => p.id === deleteId)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Payments</h1>

      <Select value={statusFilter || 'all'} onValueChange={v => setParam('status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="Filter by status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {PAYMENT_STATUSES.map(s => (
            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? <TableSkeleton cols={7} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden sm:table-cell">Transaction ID</TableHead>
                  <TableHead className="hidden md:table-cell">Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No payments found.</TableCell></TableRow>
                ) : payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">
                      <Link to={`/orders/${p.order}`} className="text-primary hover:underline">#{p.order}</Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground font-mono">{p.transaction_id || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground capitalize">{p.payment_method || '—'}</TableCell>
                    <TableCell className="text-sm font-medium">৳{parseFloat(p.amount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-muted text-muted-foreground'}`}>
                        {p.status}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditPayment(p)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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

      {/* Edit Dialog */}
      <Dialog open={!!editPayment} onOpenChange={o => { if (!o) setEditPayment(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment — Order #{editPayment?.order}</DialogTitle>
          </DialogHeader>
          {editPayment && (
            <PaymentEditModal
              payment={editPayment}
              onSave={() => { setEditPayment(null); fetchPayments() }}
              onClose={() => setEditPayment(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the payment record for{' '}
              <span className="font-medium text-foreground">Order #{deleteTarget?.order}</span>.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
