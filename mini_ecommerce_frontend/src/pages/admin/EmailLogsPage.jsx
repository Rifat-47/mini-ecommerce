import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import Pagination from '@/components/shared/Pagination'
import TableSkeleton from '@/components/shared/TableSkeleton'
import api from '@/api/axios'

export default function EmailLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [logs, setLogs] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')

  const statusFilter = searchParams.get('status') || ''
  const dateFrom = searchParams.get('date_from') || ''
  const dateTo = searchParams.get('date_to') || ''
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
      if (statusFilter) q.set('status', statusFilter)
      if (dateFrom) q.set('date_from', dateFrom)
      if (dateTo) q.set('date_to', dateTo)
      if (searchParams.get('search')) q.set('search', searchParams.get('search'))
      if (page > 1) q.set('page', page)
      const { data } = await api.get(`/admin/email-logs/?${q}`)
      setLogs(data.results ?? data)
      setCount(data.count ?? (data.results ?? data).length)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function handleSearch(e) {
    e.preventDefault()
    setParam('search', searchInput)
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Email Logs</h1>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter || 'all'} onValueChange={v => setParam('status', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-40 h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dateFrom}
          onChange={e => setParam('date_from', e.target.value)}
          className="h-9 w-full sm:w-40"
          placeholder="From date"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={e => setParam('date_to', e.target.value)}
          className="h-9 w-full sm:w-40"
          placeholder="To date"
        />

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search recipient or subject..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="h-9 w-full sm:w-56"
          />
        </form>
      </div>

      {loading ? <TableSkeleton cols={5} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="hidden md:table-cell">Error</TableHead>
                  <TableHead className="hidden sm:table-cell w-40">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      No email logs found.
                    </TableCell>
                  </TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.recipient}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{log.subject}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                      {log.error_message || '—'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString() : '—'}
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
