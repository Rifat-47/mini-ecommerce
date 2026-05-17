import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const ROLE_COLORS = {
  customer: 'bg-muted text-muted-foreground',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  superadmin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

function UserForm({ initial, onSave, onClose, markDirty, confirmClose }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    email: initial?.email || '',
    first_name: initial?.first_name || '',
    last_name: initial?.last_name || '',
    role: initial?.role || 'customer',
    password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  function validate() {
    const errors = {}
    if (!isEdit) {
      if (!form.email.trim()) errors.email = 'Email is required.'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.'
      if (!form.password) errors.password = 'Password is required.'
      else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.'
    }
    if (isEdit && form.password && form.password.length < 8) errors.password = 'Password must be at least 8 characters.'
    if (form.first_name.length > 150) errors.first_name = 'First name must be at most 150 characters.'
    if (form.last_name.length > 150) errors.last_name = 'Last name must be at most 150 characters.'
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
      if (isEdit && !payload.password) delete payload.password
      isEdit ? await api.patch(`/admin/users/${initial.id}/`, payload) : await api.post('/admin/users/', payload)
      toast.success(isEdit ? 'User updated.' : 'User created.')
      onSave()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to save user.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <ErrorMessage error={error} />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Email <span className="text-destructive">*</span></Label>
            <Input type="email" value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setFieldErrors(f => ({ ...f, email: '' })); markDirty() }} disabled={isEdit} />
            {fieldErrors.email && <p className="text-sm text-destructive mt-1">{fieldErrors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input value={form.first_name} onChange={e => { setForm(f => ({ ...f, first_name: e.target.value })); setFieldErrors(f => ({ ...f, first_name: '' })); markDirty() }} maxLength={150} />
            {fieldErrors.first_name && <p className="text-sm text-destructive mt-1">{fieldErrors.first_name}</p>}
            <MaxLengthWarning value={form.first_name} max={150} />
          </div>
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input value={form.last_name} onChange={e => { setForm(f => ({ ...f, last_name: e.target.value })); setFieldErrors(f => ({ ...f, last_name: '' })); markDirty() }} maxLength={150} />
            {fieldErrors.last_name && <p className="text-sm text-destructive mt-1">{fieldErrors.last_name}</p>}
            <MaxLengthWarning value={form.last_name} max={150} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => { setForm(f => ({ ...f, role: v })); markDirty() }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{isEdit ? 'New password (leave blank to keep)' : 'Password *'}</Label>
            <Input type="password" value={form.password} onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setFieldErrors(f => ({ ...f, password: '' })); markDirty() }} autoComplete="new-password" />
            {fieldErrors.password && <p className="text-sm text-destructive mt-1">{fieldErrors.password}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => confirmClose(onClose)}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const { markDirty, confirmClose, DiscardDialog, reset } = useUnsavedChanges()

  const roleFilter = searchParams.get('role') || ''
  const page = parseInt(searchParams.get('page') || '1')

  function setParam(key, value) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      value ? next.set(key, value) : next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (roleFilter) q.set('role', roleFilter)
      if (page > 1) q.set('page', page)
      const { data } = await api.get(`/admin/users/?${q}`)
      setUsers(data.results ?? data)
      setCount(data.count ?? (data.results ?? data).length)
    } catch { setUsers([]) }
    finally { setLoading(false) }
  }, [searchParams])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleDelete() {
    try {
      await api.delete(`/admin/users/${deleteId}/`)
      toast.success('User deleted.')
      setDeleteId(null)
      fetchUsers()
    } catch { toast.error('Failed to delete.') }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button size="sm" onClick={() => { reset(); setEditUser(null); setShowForm(true) }}><Plus className="h-4 w-4 mr-1.5" />Add User</Button>
      </div>

      <Select value={roleFilter || 'all'} onValueChange={v => setParam('role', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue placeholder="Filter by role" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          <SelectItem value="customer">Customer</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>

      {loading ? <TableSkeleton cols={5} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden sm:table-cell">Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No users found.</TableCell></TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm font-medium">{u.email}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                    <TableCell><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-muted text-muted-foreground'}`}>{u.role}</span></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { reset(); setEditUser(u); setShowForm(true) }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteId(u.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
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
      <Dialog open={showForm} onOpenChange={o => { if (!o) confirmClose(() => { setShowForm(false); setEditUser(null) }) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editUser ? 'Edit User' : 'Add User'}</DialogTitle></DialogHeader>
          <UserForm initial={editUser} onSave={() => { setShowForm(false); setEditUser(null); fetchUsers() }} onClose={() => { setShowForm(false); setEditUser(null) }} markDirty={markDirty} confirmClose={confirmClose} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the user account.</AlertDialogDescription>
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
