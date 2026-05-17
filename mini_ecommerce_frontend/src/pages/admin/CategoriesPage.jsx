import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

const STATUS_COLORS = {
  active: 'bg-success/10 text-success',
  inactive: 'bg-muted text-muted-foreground',
}
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ErrorMessage from '@/components/shared/ErrorMessage'
import MaxLengthWarning from '@/components/shared/MaxLengthWarning'
import TableSkeleton from '@/components/shared/TableSkeleton'
import useUnsavedChanges from '@/hooks/useUnsavedChanges.jsx'
import api from '@/api/axios'

function CategoryForm({ initial, onSave, onClose, markDirty, confirmClose }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    status: initial?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  function validate() {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Name is required.'
    else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
    else if (form.name.length > 100) errors.name = 'Name must be at most 100 characters.'
    if (form.description.length > 2000) errors.description = 'Description must be at most 2000 characters.'
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
      isEdit
        ? await api.patch(`/categories/${initial.id}/`, form)
        : await api.post('/categories/', form)
      toast.success(isEdit ? 'Category updated.' : 'Category created.')
      onSave()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to save category.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <ErrorMessage error={error} />
        <div className="space-y-1.5">
          <Label>Name <span className="text-destructive">*</span></Label>
          <Input
            value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFieldErrors(f => ({ ...f, name: '' })); markDirty() }}
            maxLength={100}
            placeholder="e.g. Electronics"
          />
          {fieldErrors.name && <p className="text-sm text-destructive mt-1">{fieldErrors.name}</p>}
          <MaxLengthWarning value={form.name} max={100} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setFieldErrors(f => ({ ...f, description: '' })); markDirty() }}
            placeholder="Optional description"
            maxLength={2000}
            rows={3}
          />
          {fieldErrors.description && <p className="text-sm text-destructive mt-1">{fieldErrors.description}</p>}
          <MaxLengthWarning value={form.description} max={2000} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => { setForm(f => ({ ...f, status: v })); markDirty() }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => confirmClose(onClose)}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editCategory, setEditCategory] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { markDirty, confirmClose, DiscardDialog, reset } = useUnsavedChanges()

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/categories/?all=true')
      setCategories(data.results ?? data)
    } catch {
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/categories/${deleteId}/`)
      toast.success('Category deleted.')
      setDeleteId(null)
      fetchCategories()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to delete category.'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  function openCreate() {
    reset?.()
    setEditCategory(null)
    setShowForm(true)
  }

  function openEdit(category) {
    reset?.()
    setEditCategory(category)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditCategory(null)
  }

  const deleteTarget = categories.find(c => c.id === deleteId)

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage product categories.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />Add Category
        </Button>
      </div>

      {loading ? <TableSkeleton cols={5} /> : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No categories found. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : categories.map(cat => (
                <TableRow key={cat.id}>
                  <TableCell className="text-sm text-muted-foreground">{cat.id}</TableCell>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate" title={cat.name}>{cat.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs truncate">
                    {cat.description || '—'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cat.status] || ''}`}>
                      {cat.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(cat.id)}
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
      )}

      {/* Create / Edit Dialog */}
      <DiscardDialog />
      <Dialog open={showForm} onOpenChange={o => { if (!o) confirmClose(closeForm) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            initial={editCategory}
            onSave={() => { closeForm(); fetchCategories() }}
            onClose={closeForm}
            markDirty={markDirty}
            confirmClose={confirmClose}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>.
              Products in this category will also be deleted. This cannot be undone.
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
