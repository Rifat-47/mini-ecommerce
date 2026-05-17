import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Pagination from '@/components/shared/Pagination'
import TableSkeleton from '@/components/shared/TableSkeleton'
import api from '@/api/axios'

export default function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [logs, setLogs] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [adminIdInput, setAdminIdInput] = useState(searchParams.get('admin_id') || '')

  const actionFilter = searchParams.get('action') || ''
  const adminFilter = searchParams.get('admin_id') || ''
  const page = parseInt(searchParams.get('page') || '1')

  function setParam(key, value) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      value ? next.set(key, value) : next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (actionFilter) q.set('action', actionFilter)
      if (adminFilter) q.set('admin_id', adminFilter)
      if (page > 1) q.set('page', page)
      const { data } = await api.get(`/admin/audit-log/?${q}`)
      setLogs(data.results ?? data)
      setCount(data.count ?? (data.results ?? data).length)
    } catch { setLogs([]) }
    finally { setLoading(false) }
  }, [searchParams])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function handleAdminSearch(e) {
    e.preventDefault()
    setParam('admin_id', adminIdInput)
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>

      <div className="flex flex-wrap gap-2">
        <Select value={actionFilter || 'all'} onValueChange={v => setParam('action', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-48 h-9"><SelectValue placeholder="Filter by action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="status_change">Status change</SelectItem>
          </SelectContent>
        </Select>

        <form onSubmit={handleAdminSearch} className="flex gap-2">
          <Input
            placeholder="Filter by admin ID..."
            value={adminIdInput}
            onChange={e => setAdminIdInput(e.target.value)}
            className="h-9 w-full sm:w-44"
          />
        </form>
      </div>

      {loading ? <TableSkeleton cols={4} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden sm:table-cell">Admin</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="hidden md:table-cell w-36">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">No logs found.</TableCell></TableRow>
                ) : logs.map((log, i) => (
                  <TableRow key={log.id || i}>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground capitalize">
                        {log.action || log.action_type || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{log.admin_email || log.admin || `#${log.admin_id}` || '—'}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{log.details || log.description || log.object_repr || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {log.timestamp || log.created_at
                        ? new Date(log.timestamp || log.created_at).toLocaleString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination count={count} page={page} onPageChange={p => setParam('page', String(p))} />
        </>
      )}
    </div>
  )
}
