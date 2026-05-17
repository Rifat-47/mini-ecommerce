import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, Download, Loader2, Upload, X, Star } from 'lucide-react'
import useUnsavedChanges from '@/hooks/useUnsavedChanges.jsx'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ErrorMessage from '@/components/shared/ErrorMessage'
import MaxLengthWarning from '@/components/shared/MaxLengthWarning'
import Pagination from '@/components/shared/Pagination'
import TableSkeleton from '@/components/shared/TableSkeleton'
import api from '@/api/axios'

const EMPTY_FORM = { name: '', description: '', price: '', discount_percentage: '0', stock: '', category: '', status: 'active' }

const STATUS_COLORS = {
  active: 'bg-success/10 text-success',
  inactive: 'bg-muted text-muted-foreground',
  coming_soon: 'bg-primary/10 text-primary',
}

const STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
  coming_soon: 'Coming Soon',
}

function ProductForm({ initial, categories, onSave, onClose, markDirty, confirmClose }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name || '',
    description: initial.description || '',
    price: initial.price || '',
    discount_percentage: initial.discount_percentage || '0',
    stock: initial.stock ?? '',
    category: initial.category ? String(initial.category) : '',
    status: initial.status || 'active',
  } : EMPTY_FORM)

  // Staged image state — no API calls until submit
  const [existingImages, setExistingImages] = useState(
    (initial?.images || []).map(img => ({ ...img, _deleted: false }))
  )
  const [newFiles, setNewFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const fileRef = useRef(null)

  const visibleImages = existingImages.filter(img => !img._deleted)
  const maxNewImages = 5 - visibleImages.length

  function field(key) {
    return (e) => { setForm(f => ({ ...f, [key]: e.target.value })); markDirty() }
  }

  function handleTogglePrimary(imageId) {
    setExistingImages(imgs => imgs.map(img => ({
      ...img,
      is_primary: img.id === imageId ? !img.is_primary : (img.id !== imageId && !img.is_primary ? img.is_primary : false),
    })))
    markDirty()
  }

  function handleDeleteImage(imageId) {
    setExistingImages(imgs => {
      const updated = imgs.map(img => img.id === imageId ? { ...img, _deleted: true, is_primary: false } : img)
      // if deleted was primary, promote first remaining visible
      const wasDeleted = imgs.find(img => img.id === imageId)
      if (wasDeleted?.is_primary) {
        const firstRemaining = updated.find(img => !img._deleted)
        if (firstRemaining) firstRemaining.is_primary = true
      }
      return updated
    })
    markDirty()
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, maxNewImages)
    setNewFiles(files)
    markDirty()
  }

  function validate() {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Name is required.'
    else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
    else if (form.name.length > 100) errors.name = 'Name must be at most 100 characters.'
    if (form.description.length > 2000) errors.description = 'Description must be at most 2000 characters.'
    if (!String(form.price).trim()) errors.price = 'Price is required.'
    else if (isNaN(form.price) || Number(form.price) < 0) errors.price = 'Price must be a valid positive number.'
    if (form.discount_percentage !== '' && (isNaN(form.discount_percentage) || Number(form.discount_percentage) < 0 || Number(form.discount_percentage) > 100))
      errors.discount_percentage = 'Discount must be between 0 and 100.'
    if (!String(form.stock).trim()) errors.stock = 'Stock is required.'
    else if (isNaN(form.stock) || Number(form.stock) < 0) errors.stock = 'Stock must be 0 or more.'
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
      const payload = { ...form, category: form.category || null }
      const { data } = initial?.id
        ? await api.patch(`/products/${initial.id}/`, payload)
        : await api.post('/products/', payload)

      const productId = data.id

      // Apply staged image deletions
      const toDelete = existingImages.filter(img => img._deleted)
      await Promise.allSettled(toDelete.map(img => api.delete(`/products/${productId}/images/${img.id}/`)))

      // Apply primary changes on surviving images
      const primaryChanged = existingImages.filter(img => {
        if (img._deleted) return false
        const original = initial?.images?.find(o => o.id === img.id)
        return original && original.is_primary !== img.is_primary
      })
      await Promise.allSettled(primaryChanged.map(img =>
        api.patch(`/products/${productId}/images/${img.id}/`, { is_primary: img.is_primary })
      ))

      // Upload new images
      if (newFiles.length > 0) {
        await Promise.allSettled(newFiles.map((file, i) => {
          const fd = new FormData()
          fd.append('image', file)
          if (i === 0 && !initial?.id) fd.append('is_primary', 'true')
          return api.post(`/products/${productId}/images/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        }))
      }

      toast.success(initial?.id ? 'Product updated.' : 'Product created.')
      onSave()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to save product.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <ErrorMessage error={error} />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={e => { field('name')(e); setFieldErrors(f => ({ ...f, name: '' })) }} maxLength={100} />
            {fieldErrors.name && <p className="text-sm text-destructive mt-1">{fieldErrors.name}</p>}
            <MaxLengthWarning value={form.name} max={100} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => { field('description')(e); setFieldErrors(f => ({ ...f, description: '' })) }} maxLength={2000} rows={3} />
            {fieldErrors.description && <p className="text-sm text-destructive mt-1">{fieldErrors.description}</p>}
            <MaxLengthWarning value={form.description} max={2000} />
          </div>
          <div className="space-y-1">
            <Label>Price (৳) <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.01" min="0" value={form.price} onChange={e => { field('price')(e); setFieldErrors(f => ({ ...f, price: '' })) }} />
            {fieldErrors.price && <p className="text-sm text-destructive mt-1">{fieldErrors.price}</p>}
          </div>
          <div className="space-y-1">
            <Label>Discount (%)</Label>
            <Input type="number" step="0.01" min="0" max="100" value={form.discount_percentage} onChange={e => { field('discount_percentage')(e); setFieldErrors(f => ({ ...f, discount_percentage: '' })) }} />
            {fieldErrors.discount_percentage && <p className="text-sm text-destructive mt-1">{fieldErrors.discount_percentage}</p>}
          </div>
          <div className="space-y-1">
            <Label>Stock <span className="text-destructive">*</span></Label>
            <Input type="number" min="0" value={form.stock} onChange={e => { field('stock')(e); setFieldErrors(f => ({ ...f, stock: '' })) }} />
            {fieldErrors.stock && <p className="text-sm text-destructive mt-1">{fieldErrors.stock}</p>}
          </div>
          <div className="space-y-1">
            <Label>Category <span className="text-destructive">*</span></Label>
            <Select value={form.category || 'none'} onValueChange={(v) => { setForm(f => ({ ...f, category: v === 'none' ? '' : v })); markDirty() }}>
              <SelectTrigger>
                <SelectValue placeholder="Select category">
                  {form.category
                    ? (categories.find(c => String(c.id) === form.category)?.name ?? 'Select category')
                    : 'No category'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => { setForm(f => ({ ...f, status: v })); markDirty() }}>
              <SelectTrigger>
                <SelectValue>
                  {STATUS_LABELS[form.status] ?? form.status}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="coming_soon">Coming Soon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Existing images (edit mode only) */}
          {visibleImages.length > 0 && (
            <div className="col-span-2 space-y-1.5">
              <Label>Images</Label>
              <div className="flex flex-wrap gap-3">
                {visibleImages.map(img => (
                  <div key={img.id} className="flex flex-col items-center gap-1">
                    <div className="relative w-20 h-20">
                      <img src={img.image} alt="" className={`w-full h-full object-cover rounded-md border-2 ${img.is_primary ? 'border-primary' : 'border-border'}`} />
                      {img.is_primary && (
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Star className="h-3 w-3 fill-current" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title={img.is_primary ? 'Remove feature' : 'Set as feature'}
                        onClick={() => handleTogglePrimary(img.id)}
                        className={`p-1 rounded transition-colors ${img.is_primary ? 'text-primary hover:text-muted-foreground' : 'text-muted-foreground hover:text-primary'}`}
                      >
                        <Star className={`h-3.5 w-3.5 ${img.is_primary ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        title="Delete image"
                        onClick={() => handleDeleteImage(img.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload new images */}
          {maxNewImages > 0 && (
            <div className="col-span-2 space-y-1">
              <Label>{visibleImages.length > 0 ? `Add more images (${maxNewImages} slot${maxNewImages > 1 ? 's' : ''} left)` : 'Images (max 5)'}</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Choose files
                </Button>
                {newFiles.length > 0 && <span className="text-xs text-muted-foreground">{newFiles.length} file(s) selected</span>}
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} />
            </div>
          )}

          {maxNewImages === 0 && (
            <p className="col-span-2 text-xs text-muted-foreground">Maximum of 5 images reached. Delete one to upload another.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => confirmClose(onClose)}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initial?.id ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function StockAdjustDialog({ product, onClose, onSaved }) {
  const [change, setChange] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  function validate() {
    const errors = {}
    if (!change.trim()) errors.change = 'Quantity change is required.'
    else if (isNaN(change) || parseInt(change) === 0) errors.change = 'Enter a non-zero integer.'
    if (!reason.trim()) errors.reason = 'Reason is required.'
    else if (reason.trim().length < 3) errors.reason = 'Reason must be at least 3 characters.'
    else if (reason.length > 255) errors.reason = 'Reason must be at most 255 characters.'
    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const errors = validate()
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})
    setLoading(true)
    try {
      await api.post(`/admin/products/${product.id}/adjust-stock/`, { quantity_change: parseInt(change), reason })
      toast.success('Stock adjusted.')
      onSaved()
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to adjust stock.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">Current stock: <span className="font-medium text-foreground">{product.stock}</span></p>
      <ErrorMessage error={error} />
      <div className="space-y-1.5">
        <Label>Quantity change (negative to remove) <span className="text-destructive">*</span></Label>
        <Input type="number" value={change} onChange={(e) => { setChange(e.target.value); setFieldErrors(f => ({ ...f, change: '' })) }} placeholder="e.g. 10 or -5" />
        {fieldErrors.change && <p className="text-sm text-destructive mt-1">{fieldErrors.change}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Reason <span className="text-destructive">*</span></Label>
        <Input value={reason} onChange={(e) => { setReason(e.target.value); setFieldErrors(f => ({ ...f, reason: '' })) }} placeholder="e.g. Restock, damaged goods" maxLength={255} />
        {fieldErrors.reason && <p className="text-sm text-destructive mt-1">{fieldErrors.reason}</p>}
        <MaxLengthWarning value={reason} max={255} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Adjust
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [count, setCount] = useState(0)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [editProduct, setEditProduct] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [stockProduct, setStockProduct] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
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

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ all: 'true' })
      if (searchParams.get('search')) q.set('search', searchParams.get('search'))
      if (searchParams.get('category')) q.set('category', searchParams.get('category'))
      if (page > 1) q.set('page', page)
      const { data } = await api.get(`/products/?${q}`)
      setProducts(data.results)
      setCount(data.count)
    } catch { setProducts([]) }
    finally { setLoading(false) }
  }, [searchParams])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => {
    api.get('/categories/?all=true').then(({ data }) => setCategories(data.results ?? data)).catch(() => {})
  }, [])

  function handleSearchSubmit(e) {
    e.preventDefault()
    setParam('search', search)
  }

  async function handleDelete() {
    try {
      await api.delete(`/products/${deleteId}/`)
      toast.success('Product deleted.')
      setDeleteId(null)
      fetchProducts()
    } catch { toast.error('Failed to delete.') }
  }

  async function handleExport() {
    try {
      const res = await api.get('/admin/products/export/', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = 'products.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Export failed.') }
  }

  async function handleBulkUpdate(updates) {
    if (!selected.size) return
    setBulkLoading(true)
    try {
      await api.post('/admin/products/bulk-update/', { product_ids: [...selected], ...updates })
      toast.success('Bulk update applied.')
      setSelected(new Set())
      fetchProducts()
    } catch { toast.error('Bulk update failed.') }
    finally { setBulkLoading(false) }
  }

  const allSelected = products.length > 0 && products.every(p => selected.has(p.id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map(p => p.id)))
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
          <Button size="sm" onClick={() => { reset(); setEditProduct(null); setShowForm(true) }}><Plus className="h-4 w-4 mr-1.5" />Add Product</Button>
        </div>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 min-w-0 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Button type="submit" size="sm" variant="outline">Search</Button>
        </form>
        <Select value={searchParams.get('category') || 'all'} onValueChange={v => setParam('category', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-36 h-9"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => handleBulkUpdate({ stock: 0 })}>Set stock 0</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? <TableSkeleton cols={7} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="hidden sm:table-cell">Stock</TableHead>
                  <TableHead className="hidden sm:table-cell w-24">Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No products found.</TableCell></TableRow>
                ) : products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={(v) => setSelected(s => { const n = new Set(s); v ? n.add(p.id) : n.delete(p.id); return n })} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.images?.[0]?.image && <img src={p.images[0].image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                        <span className="text-sm font-medium line-clamp-1">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[140px] truncate" title={p.category_name}>{p.category_name || '—'}</TableCell>
                    <TableCell className="text-sm">৳{parseFloat(p.price).toFixed(2)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{p.stock}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[p.status] || ''}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setStockProduct(p)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Adjust stock">
                          <span className="text-xs font-bold">±</span>
                        </button>
                        <button onClick={() => { reset(); setEditProduct(p); setShowForm(true) }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
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

      {/* Product form dialog */}
      <DiscardDialog />
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) confirmClose(() => { setShowForm(false); setEditProduct(null) }) }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editProduct ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <ProductForm initial={editProduct} categories={categories} onSave={() => { setShowForm(false); setEditProduct(null); fetchProducts() }} onClose={() => { setShowForm(false); setEditProduct(null) }} markDirty={markDirty} confirmClose={confirmClose} />
        </DialogContent>
      </Dialog>

      {/* Stock adjust dialog */}
      <Dialog open={!!stockProduct} onOpenChange={(o) => { if (!o) setStockProduct(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock — {stockProduct?.name}</DialogTitle></DialogHeader>
          {stockProduct && <StockAdjustDialog product={stockProduct} onClose={() => setStockProduct(null)} onSaved={() => { setStockProduct(null); fetchProducts() }} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The product will be permanently deleted.</AlertDialogDescription>
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
