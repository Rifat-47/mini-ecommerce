import { useState, useEffect, useRef } from 'react'
import { User, MapPin, Shield, Lock, Loader2, Plus, Trash2, Edit2, Check, Download, AlertTriangle, Camera, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import ErrorMessage from '@/components/shared/ErrorMessage'
import MaxLengthWarning from '@/components/shared/MaxLengthWarning'
import DateOfBirthPicker from '@/components/shared/DateOfBirthPicker'
import useUnsavedChanges from '@/hooks/useUnsavedChanges.jsx'
import api from '@/api/axios'
import useAuthStore from '@/store/authStore'

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">
        {value || <span className="text-muted-foreground italic">Not set</span>}
      </span>
    </div>
  )
}

const TABS = [
  { value: 'profile',   label: 'Profile',   icon: User,   description: 'Name & personal info' },
  { value: 'addresses', label: 'Addresses', icon: MapPin,  description: 'Shipping & billing' },
  { value: 'security',  label: 'Security',  icon: Lock,    description: 'Password management' },
  { value: 'privacy',   label: 'Privacy',   icon: Shield,  description: 'Data & account' },
]

/* ─── Profile Tab ─── */
function ProfileTab() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [saved, setSaved] = useState({ first_name: '', last_name: '', date_of_birth: '' })
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '' })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const { markDirty, isDirty, DiscardDialog } = useUnsavedChanges()

  useEffect(() => {
    api.get('/auth/profile/').then(({ data }) => {
      const values = {
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth || '',
      }
      setSaved(values)
      setForm(values)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function handleEdit() {
    setForm(saved)
    setError(null)
    setEditing(true)
  }

  function handleCancel() {
    setForm(saved)
    setEditing(false)
    setError(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.date_of_birth) payload.date_of_birth = null
      const { data } = await api.patch('/auth/profile/', payload)
      const updated = { first_name: data.first_name, last_name: data.last_name, date_of_birth: data.date_of_birth || '' }
      setSaved(updated)
      setForm(updated)
      updateUser({ first_name: data.first_name, last_name: data.last_name })
      setEditing(false)
      toast.success('Profile updated.')
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to update profile.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-6 w-40" />
    </div>
  )

  /* ── Read view ── */
  if (!editing) {
    const dobDisplay = saved.date_of_birth
      ? new Date(saved.date_of_birth + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : ''

    return (
      <div className="space-y-1">
        <div className="flex justify-end mb-2">
          <Button type="button" variant="outline" size="sm" onClick={handleEdit}>
            <Edit2 className="h-3.5 w-3.5 mr-1.5" />Edit
          </Button>
        </div>
        <Row label="Email" value={user?.email} />
        <Row label="First name" value={saved.first_name} />
        <Row label="Last name" value={saved.last_name} />
        <Row label="Date of birth" value={dobDisplay} />
      </div>
    )
  }

  /* ── Edit view ── */
  return (
    <>
      <DiscardDialog />
      <form onSubmit={handleSave} noValidate className="space-y-5">
        <ErrorMessage error={error} />

        <div className="space-y-1.5">
          <Label htmlFor="p-email">Email</Label>
          <Input id="p-email" value={user?.email || ''} disabled className="h-9 bg-muted text-muted-foreground cursor-not-allowed" />
          <p className="text-xs text-muted-foreground">Email address cannot be changed.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-first">First name</Label>
            <Input
              id="p-first"
              value={form.first_name}
              onChange={(e) => { setForm((f) => ({ ...f, first_name: e.target.value })); markDirty() }}
              maxLength={25}
              className="h-9"
              placeholder="John"
              autoFocus
            />
            <MaxLengthWarning value={form.first_name} max={25} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-last">Last name</Label>
            <Input
              id="p-last"
              value={form.last_name}
              onChange={(e) => { setForm((f) => ({ ...f, last_name: e.target.value })); markDirty() }}
              maxLength={25}
              className="h-9"
              placeholder="Doe"
            />
            <MaxLengthWarning value={form.last_name} max={25} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Date of birth</Label>
          <DateOfBirthPicker
            initialValue={form.date_of_birth}
            onChange={val => { setForm(f => ({ ...f, date_of_birth: val })); markDirty() }}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        </div>
      </form>
    </>
  )
}

/* ─── Field wrapper (must be at module level to avoid focus loss) ─── */
function FieldGroup({ label, required, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

/* ─── Address Form ─── */
function AddressFormInline({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    label: initial.label || '',
    full_name: initial.full_name || '',
    phone: initial.phone || '',
    address_line_1: initial.address_line_1 || '',
    address_line_2: initial.address_line_2 || '',
    city: initial.city || '',
    state: initial.state || '',
    postal_code: initial.postal_code || '',
    country: initial.country || 'BD',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const { markDirty, confirmClose, DiscardDialog } = useUnsavedChanges()

  function field(key) {
    return (e) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setFieldErrors((f) => ({ ...f, [key]: '' }))
      markDirty()
    }
  }

  function validate() {
    const errors = {}
    if (!form.full_name.trim()) errors.full_name = 'Full name is required.'
    else if (form.full_name.trim().length < 2) errors.full_name = 'Full name must be at least 2 characters.'
    else if (form.full_name.length > 255) errors.full_name = 'Full name must be at most 255 characters.'
    if (!form.phone.trim()) errors.phone = 'Phone is required.'
    else if (form.phone.trim().length < 7) errors.phone = 'Phone must be at least 7 characters.'
    else if (form.phone.length > 20) errors.phone = 'Phone must be at most 20 characters.'
    if (!form.address_line_1.trim()) errors.address_line_1 = 'Address is required.'
    else if (form.address_line_1.trim().length < 5) errors.address_line_1 = 'Address must be at least 5 characters.'
    else if (form.address_line_1.length > 255) errors.address_line_1 = 'Address must be at most 255 characters.'
    if (form.address_line_2.length > 255) errors.address_line_2 = 'Must be at most 255 characters.'
    if (!form.city.trim()) errors.city = 'City is required.'
    else if (form.city.trim().length < 2) errors.city = 'City must be at least 2 characters.'
    else if (form.city.length > 100) errors.city = 'City must be at most 100 characters.'
    if (!form.state.trim()) errors.state = 'State is required.'
    else if (form.state.trim().length < 2) errors.state = 'State must be at least 2 characters.'
    else if (form.state.length > 100) errors.state = 'State must be at most 100 characters.'
    if (!form.postal_code.trim()) errors.postal_code = 'Postal code is required.'
    else if (form.postal_code.trim().length < 3) errors.postal_code = 'Postal code must be at least 3 characters.'
    else if (form.postal_code.length > 20) errors.postal_code = 'Postal code must be at most 20 characters.'
    if (form.label.length > 50) errors.label = 'Label must be at most 50 characters.'
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
      const { data } = initial.id
        ? await api.patch(`/addresses/${initial.id}/`, form)
        : await api.post('/addresses/', form)
      onSave(data)
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to save address.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DiscardDialog />
      <form onSubmit={handleSubmit} noValidate className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
        <ErrorMessage error={error} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldGroup label="Full name" required>
            <Input value={form.full_name} onChange={field('full_name')} maxLength={255} className="h-9" />
            {fieldErrors.full_name && <p className="text-xs text-destructive mt-1">{fieldErrors.full_name}</p>}
            <MaxLengthWarning value={form.full_name} max={255} />
          </FieldGroup>
          <FieldGroup label="Phone" required>
            <Input value={form.phone} onChange={field('phone')} maxLength={20} className="h-9" />
            {fieldErrors.phone && <p className="text-xs text-destructive mt-1">{fieldErrors.phone}</p>}
            <MaxLengthWarning value={form.phone} max={20} />
          </FieldGroup>
        </div>

        <FieldGroup label="Address line 1" required>
          <Input value={form.address_line_1} onChange={field('address_line_1')} maxLength={255} className="h-9" />
          {fieldErrors.address_line_1 && <p className="text-xs text-destructive mt-1">{fieldErrors.address_line_1}</p>}
          <MaxLengthWarning value={form.address_line_1} max={255} />
        </FieldGroup>

        <FieldGroup label="Address line 2">
          <Input value={form.address_line_2} onChange={field('address_line_2')} maxLength={255} className="h-9" placeholder="Apt, suite, floor…" />
          {fieldErrors.address_line_2 && <p className="text-xs text-destructive mt-1">{fieldErrors.address_line_2}</p>}
        </FieldGroup>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <FieldGroup label="City" required>
              <Input value={form.city} onChange={field('city')} maxLength={100} className="h-9" />
              {fieldErrors.city && <p className="text-xs text-destructive mt-1">{fieldErrors.city}</p>}
            </FieldGroup>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <FieldGroup label="State / Division" required>
              <Input value={form.state} onChange={field('state')} maxLength={100} className="h-9" />
              {fieldErrors.state && <p className="text-xs text-destructive mt-1">{fieldErrors.state}</p>}
            </FieldGroup>
          </div>
          <FieldGroup label="Postal code" required>
            <Input value={form.postal_code} onChange={field('postal_code')} maxLength={20} className="h-9" />
            {fieldErrors.postal_code && <p className="text-xs text-destructive mt-1">{fieldErrors.postal_code}</p>}
          </FieldGroup>
          <FieldGroup label="Label">
            <Input value={form.label} onChange={field('label')} maxLength={50} className="h-9" placeholder="Home, Work…" />
            {fieldErrors.label && <p className="text-xs text-destructive mt-1">{fieldErrors.label}</p>}
          </FieldGroup>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {initial.id ? 'Update Address' : 'Save Address'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => confirmClose(onCancel)}>Cancel</Button>
        </div>
      </form>
    </>
  )
}

/* ─── Addresses Tab ─── */
function AddressesTab() {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    api.get('/addresses/').then(({ data }) => setAddresses(data.results ?? data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function handleSaved(addr) {
    setAddresses((prev) => {
      const idx = prev.findIndex((a) => a.id === addr.id)
      return idx >= 0 ? prev.map((a) => (a.id === addr.id ? addr : a)) : [addr, ...prev]
    })
    setShowForm(false)
    setEditingId(null)
    toast.success('Address saved.')
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/addresses/${id}/`)
      setAddresses((prev) => prev.filter((a) => a.id !== id))
      toast.success('Address deleted.')
    } catch {
      toast.error('Failed to delete address.')
    }
  }

  async function handleSetDefault(id, type) {
    try {
      await api.patch(`/addresses/${id}/set-default/`, { type })
      const { data } = await api.get('/addresses/')
      setAddresses(data.results ?? data)
      toast.success(`Default ${type} address updated.`)
    } catch {
      toast.error('Failed to update default.')
    }
  }

  if (loading) return (
    <div className="space-y-3">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  )

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !showForm && (
        <div className="text-center py-10 border border-dashed border-border rounded-lg">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium mb-0.5">No addresses saved yet</p>
          <p className="text-xs text-muted-foreground mb-4">Add a shipping or billing address to speed up checkout.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Add Address
          </Button>
        </div>
      )}

      {addresses.map((addr) => (
        <div key={addr.id} className="rounded-lg border border-border overflow-hidden">
          {editingId === addr.id ? (
            <div className="p-1">
              <AddressFormInline
                initial={addr}
                onSave={handleSaved}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{addr.full_name}</span>
                    {addr.label && (
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full border border-border">
                        {addr.label}
                      </span>
                    )}
                  </div>
                  <TooltipProvider>
                    <Tooltip content={addr.address_line_1}>
                      <p className="text-sm text-muted-foreground truncate max-w-sm">{addr.address_line_1}</p>
                    </Tooltip>
                  </TooltipProvider>
                  {addr.address_line_2 && (
                    <TooltipProvider>
                      <Tooltip content={addr.address_line_2}>
                        <p className="text-sm text-muted-foreground truncate max-w-sm">{addr.address_line_2}</p>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {addr.city}, {addr.state} {addr.postal_code}
                  </p>
                  <p className="text-sm text-muted-foreground">{addr.phone}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditingId(addr.id)}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Edit address"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete address"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                {addr.is_default_shipping ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                    <Check className="h-3 w-3" />Default shipping
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetDefault(addr.id, 'shipping')}
                    className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                  >
                    Set as default shipping
                  </button>
                )}
                {addr.is_default_billing ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                    <Check className="h-3 w-3" />Default billing
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetDefault(addr.id, 'billing')}
                    className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                  >
                    Set as default billing
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <AddressFormInline onSave={handleSaved} onCancel={() => setShowForm(false)} />
      )}

      {!showForm && addresses.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Add Address
        </Button>
      )}
    </div>
  )
}

/* ─── Security Tab ─── */
function SecurityTab() {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    setFieldErrors((f) => ({ ...f, [name]: '' }))
  }

  function validate() {
    const errors = {}
    if (!form.old_password) errors.old_password = 'Current password is required.'
    if (!form.new_password) errors.new_password = 'New password is required.'
    else if (form.new_password.length < 8) errors.new_password = 'Password must be at least 8 characters.'
    else if (form.new_password.length > 20) errors.new_password = 'Password must be at most 20 characters.'
    if (!form.confirm_password) errors.confirm_password = 'Please confirm your new password.'
    else if (form.new_password !== form.confirm_password) errors.confirm_password = 'Passwords do not match.'
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
      await api.post('/auth/update-password/', {
        old_password: form.old_password,
        new_password: form.new_password,
      })
      toast.success('Password updated successfully.')
      setForm({ old_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setError(err.response?.data || { error: 'Failed to update password.' })
    } finally {
      setLoading(false)
    }
  }

  const inputType = showPasswords ? 'text' : 'password'

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <ErrorMessage error={error} />

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="old_password">Current password <span className="text-destructive">*</span></Label>
          <Input
            id="old_password"
            name="old_password"
            type={inputType}
            value={form.old_password}
            onChange={handleChange}
            autoComplete="current-password"
            maxLength={20}
            className="h-9"
          />
          {fieldErrors.old_password && <p className="text-sm text-destructive">{fieldErrors.old_password}</p>}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">New password</p>
          <button
            type="button"
            onClick={() => setShowPasswords(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {showPasswords ? 'Hide' : 'Show'} passwords
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new_password">New password <span className="text-destructive">*</span></Label>
          <Input
            id="new_password"
            name="new_password"
            type={inputType}
            placeholder="8–20 characters"
            value={form.new_password}
            onChange={handleChange}
            autoComplete="new-password"
            maxLength={20}
            className="h-9"
          />
          {fieldErrors.new_password && <p className="text-sm text-destructive">{fieldErrors.new_password}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm_password">Confirm new password <span className="text-destructive">*</span></Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type={inputType}
            value={form.confirm_password}
            onChange={handleChange}
            autoComplete="new-password"
            maxLength={20}
            className="h-9"
          />
          {fieldErrors.confirm_password && <p className="text-sm text-destructive">{fieldErrors.confirm_password}</p>}
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Update Password
      </Button>
    </form>
  )
}

/* ─── Privacy Tab ─── */
function PrivacyTab() {
  const logout = useAuthStore((s) => s.logout)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const { data } = await api.get('/profile/export/')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-data-export.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported.')
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault()
    setDeleteError(null)
    setDeleting(true)
    try {
      await api.delete('/profile/delete/', { data: { password: deletePassword } })
      toast.success('Account deleted.')
      await logout()
    } catch (err) {
      setDeleteError(err.response?.data || { error: 'Failed to delete account.' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Data export */}
      <div className="rounded-lg border border-border p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-sm mb-1">Export your data</h3>
            <p className="text-sm text-muted-foreground">
              Download a JSON file containing your profile, addresses, and order history.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Download my data
        </Button>
      </div>

      <Separator />

      {/* Account deletion */}
      <div className="rounded-lg border border-destructive/30 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h3 className="font-medium text-sm text-destructive mb-1">Delete account</h3>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account. Orders will be anonymised, not deleted. This action cannot be undone.
            </p>
          </div>
        </div>

        {!confirmDelete ? (
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
            Delete my account
          </Button>
        ) : (
          <form onSubmit={handleDeleteAccount} noValidate className="space-y-3 pt-1">
            <ErrorMessage error={deleteError} />
            <div className="space-y-1.5">
              <Label htmlFor="delete_password" className="text-sm">
                Enter your password to confirm <span className="text-destructive">*</span>
              </Label>
              <Input
                id="delete_password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-9 max-w-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" size="sm" disabled={deleting}>
                {deleting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Confirm deletion
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setConfirmDelete(false); setDeletePassword(''); setDeleteError(null) }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* ─── Tab content map ─── */
const TAB_CONTENT = {
  profile:   { title: 'Profile',   description: 'Update your name and personal details.', Component: ProfileTab },
  addresses: { title: 'Addresses', description: 'Manage your shipping and billing addresses.', Component: AddressesTab },
  security:  { title: 'Security',  description: 'Change your password to keep your account safe.', Component: SecurityTab },
  privacy:   { title: 'Privacy',   description: 'Export your data or permanently delete your account.', Component: PrivacyTab },
}

/* ─── Avatar Header ─── */
function AvatarHeader({ user }) {
  const updateUser = useAuthStore((s) => s.updateUser)
  const fileInputRef = useRef(null)
  const menuRef = useRef(null)

  const [preview, setPreview] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // Close menu on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) { toast.error('Only JPG, PNG, and WebP images are allowed.'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB.'); return }
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setShowMenu(false)
    e.target.value = ''
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', selectedFile)
      const { data } = await api.post('/auth/profile/avatar/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      updateUser({ avatar: data.avatar_url })
      setPreview(null)
      setSelectedFile(null)
      toast.success('Profile picture updated.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  function handleCancelPreview() {
    setPreview(null)
    setSelectedFile(null)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete('/auth/profile/avatar/')
      updateUser({ avatar: null })
      toast.success('Profile picture removed.')
    } catch {
      toast.error('Failed to remove profile picture.')
    } finally {
      setDeleting(false)
      setShowMenu(false)
    }
  }

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || null
  const initials = user?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'
  const avatarSrc = preview || user?.avatar

  return (
    <div className="flex items-center gap-5 mb-8">
      {/* Avatar with edit overlay */}
      <div className="relative shrink-0" ref={menuRef}>
        <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary/20 bg-primary/10 flex items-center justify-center">
          {avatarSrc
            ? <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-primary">{initials}</span>
          }
        </div>

        {/* Camera button */}
        {!preview && (
          <button
            onClick={() => user?.avatar ? setShowMenu(m => !m) : fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors ring-2 ring-background"
            title="Change profile picture"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Dropdown menu (only when avatar exists) */}
        {showMenu && (
          <div className="absolute top-full left-0 mt-2 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
            <button
              onClick={() => { fileInputRef.current?.click(); setShowMenu(false) }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Camera className="h-3.5 w-3.5 text-muted-foreground" />Change photo
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              {deleting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />
              }
              Remove photo
            </button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Name / email / upload confirm */}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold truncate">{displayName || 'My Account'}</h1>
        <p className="text-sm text-muted-foreground truncate">{user?.email}</p>

        {preview && (
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" onClick={handleUpload} disabled={uploading}>
              {uploading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Upload photo
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelPreview} disabled={uploading}>
              <X className="h-3.5 w-3.5 mr-1" />Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ─── */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState('profile')

  const { title, description, Component } = TAB_CONTENT[activeTab]

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">

      <AvatarHeader user={user} />

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">

        {/* ── Sidebar nav (desktop) ── */}
        <nav className="hidden lg:flex flex-col gap-1 w-52 shrink-0">
          {TABS.map(({ value, label, icon: Icon, description: desc }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                'flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors',
                activeTab === value
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium leading-tight">{label}</div>
                <div className={cn('text-xs truncate', activeTab === value ? 'text-primary/70' : 'text-muted-foreground')}>
                  {desc}
                </div>
              </div>
            </button>
          ))}
        </nav>

        {/* ── Mobile tab bar ── */}
        <div className="lg:hidden flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap shrink-0 transition-colors',
                activeTab === value
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 pb-6">
              <Component key={activeTab} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
