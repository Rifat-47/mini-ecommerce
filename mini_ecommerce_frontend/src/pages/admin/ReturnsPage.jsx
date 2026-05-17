import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ErrorMessage from '@/components/shared/ErrorMessage'
import Pagination from '@/components/shared/Pagination'
import TableSkeleton from '@/components/shared/TableSkeleton'
import api from '@/api/axios'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
}

function ReviewDialog({ returnItem, onClose, onSaved }) {
  const [status, setStatus] = useState('')
  const [note, setNote] = useState(returnItem.admin_note || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!status) { setError({ error: 'Select a decision.' }); return }
    setError(null)
    setLoading(true)
    try {
      await api.patch(`/admin/returns/${returnItem.id}/`, { status, admin_note: note })
      toast.success(`Return ${status}.`)
      onSaved()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to update return.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleRefund() {
    setLoading(true)
    try {
      await api.post(`/admin/returns/${returnItem.id}/refund/`)
      toast.success('Refund marked as complete.')
      onSaved()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to process refund.' })
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-sm space-y-1 p-3 bg-muted/30 rounded-lg">
        <p><span className="text-muted-foreground">Order:</span> <span className="font-medium">#{returnItem.order}</span></p>
        <p><span className="text-muted-foreground">Reason:</span> {returnItem.reason}</p>
        <p><span className="text-muted-foreground">Current status:</span> <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[returnItem.status] || 'bg-muted text-muted-foreground'}`}>{returnItem.status}</span></p>
      </div>
      <ErrorMessage error={error} />
      <div className="space-y-1.5">
        <Label>Decision <span className="text-destructive">*</span></Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Select decision" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="approved">Approve</SelectItem>
            <SelectItem value="rejected">Reject</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Admin note (optional)</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Reason for decision..." />
      </div>
      <DialogFooter className="flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        {returnItem.status === 'approved' && (
          <Button type="button" variant="outline" disabled={loading} onClick={handleRefund}>
            {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Mark Refund Complete
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save Decision
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function ReturnsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [returns, setReturns] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reviewItem, setReviewItem] = useState(null)

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

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (statusFilter) q.set('status', statusFilter)
      if (page > 1) q.set('page', page)
      const { data } = await api.get(`/admin/returns/?${q}`)
      setReturns(data.results ?? data)
      setCount(data.count ?? (data.results ?? data).length)
    } catch { setReturns([]) }
    finally { setLoading(false) }
  }, [searchParams])

  useEffect(() => { fetchReturns() }, [fetchReturns])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Return Requests</h1>
      </div>

      <Select value={statusFilter || 'all'} onValueChange={v => setParam('status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="Filter by status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>

      {loading ? <TableSkeleton cols={5} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden sm:table-cell">Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No returns found.</TableCell></TableRow>
                ) : returns.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">#{r.order}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{r.user_email || r.user || '—'}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{r.reason}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-muted text-muted-foreground'}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReviewItem(r)}>Review</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination count={count} page={page} onPageChange={p => setParam('page', String(p))} />
        </>
      )}

      <Dialog open={!!reviewItem} onOpenChange={o => { if (!o) setReviewItem(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Return Request</DialogTitle></DialogHeader>
          {reviewItem && <ReviewDialog returnItem={reviewItem} onClose={() => setReviewItem(null)} onSaved={() => { setReviewItem(null); fetchReturns() }} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
