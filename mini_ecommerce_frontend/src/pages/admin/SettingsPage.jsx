import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import useSettingsStore from '@/store/settingsStore'
import MaxLengthWarning from '@/components/shared/MaxLengthWarning'
import useAuthStore from '@/store/authStore'

function SettingSection({ title, children }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Field({ label, id, children, hint }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
      <Label htmlFor={id} className="pt-2 text-sm font-medium">{label}</Label>
      <div className="sm:col-span-2 space-y-1">
        {children}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

function SwitchField({ label, id, checked, onChange, disabled, hint }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { settings, fetchSettings, updateSettings } = useSettingsStore()
  const isSuperAdmin = user?.role === 'superadmin'

  const [form, setForm] = useState({ ...settings })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchSettings() }, [])
  useEffect(() => { setForm({ ...settings }) }, [settings])

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updateSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'string' ? d : d?.detail || JSON.stringify(d) || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const disabled = !isSuperAdmin

  return (
    <form onSubmit={handleSave} className="p-6 space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Site Settings</h1>
          {!isSuperAdmin && (
            <p className="text-sm text-muted-foreground mt-1">You can view settings but only superadmins can edit.</p>
          )}
        </div>
        {isSuperAdmin && (
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2">
          {error}
        </div>
      )}

      {/* Store Identity */}
      <SettingSection title="Store Identity">
        <Field label="Store Name" id="store_name" hint="Used across the UI, emails, and PDFs.">
          <Input id="store_name" value={form.store_name || ''} onChange={e => set('store_name', e.target.value)} disabled={disabled} maxLength={100} />
          <MaxLengthWarning value={form.store_name || ''} max={100} />
        </Field>
        <Field label="Support Email" id="support_email" hint="Shown in invoices and credit notes.">
          <Input id="support_email" type="email" value={form.support_email || ''} onChange={e => set('support_email', e.target.value)} disabled={disabled} maxLength={254} />
          <MaxLengthWarning value={form.support_email || ''} max={254} />
        </Field>
        <Field label="From Email" id="from_email" hint="Sender address for all outgoing emails.">
          <Input id="from_email" type="email" value={form.from_email || ''} onChange={e => set('from_email', e.target.value)} disabled={disabled} maxLength={254} />
          <MaxLengthWarning value={form.from_email || ''} max={254} />
        </Field>
        <Field label="Contact Phone" id="contact_phone">
          <Input id="contact_phone" value={form.contact_phone || ''} onChange={e => set('contact_phone', e.target.value)} disabled={disabled} maxLength={20} />
          <MaxLengthWarning value={form.contact_phone || ''} max={20} />
        </Field>
        <Field label="Currency" id="currency" hint="Display label (e.g. BDT, USD).">
          <Input id="currency" value={form.currency || ''} onChange={e => set('currency', e.target.value)} disabled={disabled} className="w-28" maxLength={10} />
          <MaxLengthWarning value={form.currency || ''} max={10} />
        </Field>
        <Field label="Tax Rate (%)" id="tax_rate">
          <Input id="tax_rate" type="number" min="0" step="0.01" value={form.tax_rate ?? 0} onChange={e => set('tax_rate', e.target.value)} disabled={disabled} className="w-28" />
        </Field>
      </SettingSection>

      {/* Orders */}
      <SettingSection title="Orders">
        <Field label="Return Window (days)" id="return_window_days" hint="How many days after delivery a customer can request a return.">
          <Input id="return_window_days" type="number" min="1" value={form.return_window_days ?? 7} onChange={e => set('return_window_days', parseInt(e.target.value))} disabled={disabled} className="w-28" />
        </Field>
        <Field label="Free Shipping Threshold" id="free_shipping_threshold" hint="Set 0 to disable free shipping.">
          <Input id="free_shipping_threshold" type="number" min="0" step="0.01" value={form.free_shipping_threshold ?? 0} onChange={e => set('free_shipping_threshold', e.target.value)} disabled={disabled} className="w-36" />
        </Field>
      </SettingSection>

      {/* Reviews */}
      <SettingSection title="Reviews">
        <Field label="Review Edit Window (days)" id="review_edit_days" hint="How many days after submission a customer can edit or delete their review. Set to 0 for no limit.">
          <Input id="review_edit_days" type="number" min="0" value={form.review_edit_days ?? 0} onChange={e => set('review_edit_days', parseInt(e.target.value))} disabled={disabled} className="w-28" />
        </Field>
      </SettingSection>

      {/* Birthday Coupon */}
      <SettingSection title="Birthday Coupon">
        <SwitchField
          id="birthday_coupon_enabled"
          label="Enable Birthday Coupons"
          hint="Send a personal discount coupon to users on their birthday."
          checked={!!form.birthday_coupon_enabled}
          onChange={v => set('birthday_coupon_enabled', v)}
          disabled={disabled}
        />
        <Separator />
        <Field label="Discount (%)" id="birthday_coupon_discount">
          <Input id="birthday_coupon_discount" type="number" min="1" max="100" value={form.birthday_coupon_discount ?? 20} onChange={e => set('birthday_coupon_discount', parseInt(e.target.value))} disabled={disabled} className="w-28" />
        </Field>
        <Field label="Validity (days)" id="birthday_coupon_validity_days">
          <Input id="birthday_coupon_validity_days" type="number" min="1" value={form.birthday_coupon_validity_days ?? 30} onChange={e => set('birthday_coupon_validity_days', parseInt(e.target.value))} disabled={disabled} className="w-28" />
        </Field>
      </SettingSection>

      {/* Payments */}
      <SettingSection title="Payments">
        <SwitchField
          id="cod_enabled"
          label="Enable Cash on Delivery"
          checked={!!form.cod_enabled}
          onChange={v => set('cod_enabled', v)}
          disabled={disabled}
        />
        <SwitchField
          id="online_payment_enabled"
          label="Enable Online Payment (ShurjoPay)"
          checked={!!form.online_payment_enabled}
          onChange={v => set('online_payment_enabled', v)}
          disabled={disabled}
        />
        <Separator />
        <Field label="COD Min Order Value" id="cod_min_order_value" hint="Set 0 for no minimum.">
          <Input id="cod_min_order_value" type="number" min="0" step="0.01" value={form.cod_min_order_value ?? 0} onChange={e => set('cod_min_order_value', e.target.value)} disabled={disabled} className="w-36" />
        </Field>
      </SettingSection>

      {/* Notifications */}
      <SettingSection title="Notifications">
        <SwitchField
          id="email_notifications_enabled"
          label="Enable Email Notifications"
          hint="When disabled, no order/payment/return emails are sent to customers."
          checked={!!form.email_notifications_enabled}
          onChange={v => set('email_notifications_enabled', v)}
          disabled={disabled}
        />
      </SettingSection>

      {/* Security */}
      <SettingSection title="Security & Access">
        <SwitchField
          id="registration_enabled"
          label="Allow New Registrations"
          hint="When disabled, the register endpoint returns 403."
          checked={!!form.registration_enabled}
          onChange={v => set('registration_enabled', v)}
          disabled={disabled}
        />
        <Separator />
        <Field label="Max Login Attempts" id="max_login_attempts" hint="Failed attempts before account lockout.">
          <Input id="max_login_attempts" type="number" min="1" value={form.max_login_attempts ?? 5} onChange={e => set('max_login_attempts', parseInt(e.target.value))} disabled={disabled} className="w-28" />
        </Field>
        <Field label="Lockout Duration (min)" id="lockout_minutes">
          <Input id="lockout_minutes" type="number" min="1" value={form.lockout_minutes ?? 15} onChange={e => set('lockout_minutes', parseInt(e.target.value))} disabled={disabled} className="w-28" />
        </Field>
      </SettingSection>

      {isSuperAdmin && (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      )}
    </form>
  )
}
