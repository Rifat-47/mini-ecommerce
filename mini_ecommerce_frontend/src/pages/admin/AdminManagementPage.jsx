import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
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
import TableSkeleton from '@/components/shared/TableSkeleton'
import Pagination from '@/components/shared/Pagination'
import useUnsavedChanges from '@/hooks/useUnsavedChanges.jsx'
import api from '@/api/axios'
import useAuthStore from '@/store/authStore'

const ROLE_COLORS = {
  superadmin: 'bg-violet-100 text-violet-800 border-violet-200',
  admin: 'bg-blue-100 text-blue-800 border-blue-200',
}

function AdminForm({ onSave, onClose, markDirty, confirmClose }) {
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    role: 'admin',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  function validate() {
    const errors = {}
    if (!form.email.trim()) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.'
    if (!form.password) errors.password = 'Password is required.'
    else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.'
    else if (form.password.length > 20) errors.password = 'Password must be at most 20 characters.'
    if (form.first_name.length > 25) errors.first_name = 'First name must be at most 25 characters.'
    if (form.last_name.length > 25) errors.last_name = 'Last name must be at most 25 characters.'
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
      await api.post('/admin/users/', form)
      toast.success('Admin created.')
      onSave()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to create admin.' })
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
            <Input type="email" value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setFieldErrors(f => ({ ...f, email: '' })); markDirty() }} />
            {fieldErrors.email && <p className="text-sm text-destructive mt-1">{fieldErrors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input value={form.first_name} onChange={e => { setForm(f => ({ ...f, first_name: e.target.value })); setFieldErrors(f => ({ ...f, first_name: '' })); markDirty() }} maxLength={25} />
            {fieldErrors.first_name && <p className="text-sm text-destructive mt-1">{fieldErrors.first_name}</p>}
            <MaxLengthWarning value={form.first_name} max={25} />
          </div>
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input value={form.last_name} onChange={e => { setForm(f => ({ ...f, last_name: e.target.value })); setFieldErrors(f => ({ ...f, last_name: '' })); markDirty() }} maxLength={25} />
            {fieldErrors.last_name && <p className="text-sm text-destructive mt-1">{fieldErrors.last_name}</p>}
            <MaxLengthWarning value={form.last_name} max={25} />
          </div>
          <div className="space-y-1.5">
            <Label>Role <span className="text-destructive">*</span></Label>
            <Select value={form.role} onValueChange={v => { setForm(f => ({ ...f, role: v })); markDirty() }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="superadmin">Superadmin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Password <span className="text-destructive">*</span></Label>
            <Input type="password" value={form.password} onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setFieldErrors(f => ({ ...f, password: '' })); markDirty() }} autoComplete="new-password" maxLength={20} />
            {fieldErrors.password && <p className="text-sm text-destructive mt-1">{fieldErrors.password}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => confirmClose(onClose)}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Admin
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export default function AdminManagementPage() {
  const { user: currentUser, isSuperAdmin } = useAuthStore()
  const [admins, setAdmins] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { markDirty, confirmClose, DiscardDialog, reset } = useUnsavedChanges()

  const fetchAdmins = useCallback(async () => {
    setLoading(true)
    try {
      const q = page > 1 ? `?page=${page}` : ''
      const { data } = await api.get(`/admin/admins/${q}`)
      setAdmins(data.results ?? data)
      setCount(data.count ?? (data.results ?? data).length)
    } catch {
      setAdmins([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchAdmins() }, [fetchAdmins])

  async function handleRoleChange(userId, newRole) {
    setUpdating(userId)
    setError('')
    try {
      await api.patch(`/admin/users/${userId}/`, { role: newRole })
      setAdmins(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      toast.success('Role updated.')
    } catch (err) {
      const msg = err.response?.data?.role?.[0] || err.response?.data?.detail || 'Failed to update role.'
      setError(msg)
    } finally {
      setUpdating(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/admin/users/${deleteId}/`)
      toast.success('Admin deleted.')
      setDeleteId(null)
      fetchAdmins()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to delete admin.'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const deleteTarget = admins.find(a => a.id === deleteId)

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage admin and superadmin accounts.</p>
        </div>
        {isSuperAdmin() && (
          <Button size="sm" onClick={() => { reset(); setShowForm(true) }}>
            <Plus className="h-4 w-4 mr-1.5" />Add Admin
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2">
          {error}
        </div>
      )}

      {loading ? <TableSkeleton cols={5} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead>Change Role</TableHead>
                  {isSuperAdmin() && <TableHead className="w-16 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin() ? 6 : 5} className="text-center text-muted-foreground py-10">
                      No admin users found.
                    </TableCell>
                  </TableRow>
                ) : admins.map(admin => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">
                      {admin.first_name || admin.last_name
                        ? `${admin.first_name ?? ''} ${admin.last_name ?? ''}`.trim()
                        : '—'}
                      {admin.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{admin.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ROLE_COLORS[admin.role] ?? ''}`}>
                        {admin.role}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {admin.date_joined ? new Date(admin.date_joined).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      {admin.id === currentUser?.id ? (
                        <span className="text-xs text-muted-foreground">Cannot change own role</span>
                      ) : (
                        <Select
                          value={admin.role}
                          onValueChange={v => handleRoleChange(admin.id, v)}
                          disabled={updating === admin.id}
                        >
                          <SelectTrigger className="h-8 w-28 sm:w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="superadmin">superadmin</SelectItem>
                            <SelectItem value="customer">Demote to customer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    {isSuperAdmin() && (
                      <TableCell className="text-right">
                        {admin.id !== currentUser?.id && (
                          <button
                            onClick={() => setDeleteId(admin.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete admin"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination count={count} page={page} onPageChange={setPage} />
        </>
      )}

      {/* Create Admin Dialog */}
      <DiscardDialog />
      <Dialog open={showForm} onOpenChange={o => { if (!o) confirmClose(() => setShowForm(false)) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Admin</DialogTitle></DialogHeader>
          <AdminForm
            onSave={() => { setShowForm(false); fetchAdmins() }}
            onClose={() => setShowForm(false)}
            markDirty={markDirty}
            confirmClose={confirmClose}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete admin?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-medium text-foreground">{deleteTarget?.email}</span>.
              This action cannot be undone.
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
