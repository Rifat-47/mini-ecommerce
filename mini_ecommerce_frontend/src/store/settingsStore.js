import { create } from 'zustand'
import api from '@/api/axios'

const DEFAULTS = {
  store_name: '',
  support_email: '',
  from_email: '',
  contact_phone: '',
  currency: 'BDT',
  tax_rate: 0,
  return_window_days: 7,
  free_shipping_threshold: 0,
  birthday_coupon_enabled: true,
  birthday_coupon_discount: 20,
  birthday_coupon_validity_days: 30,
  cod_enabled: true,
  online_payment_enabled: true,
  cod_min_order_value: 0,
  email_notifications_enabled: true,
  registration_enabled: true,
  max_login_attempts: 5,
  lockout_minutes: 15,
}

const useSettingsStore = create((set, get) => ({
  settings: { ...DEFAULTS },
  loaded: false,

  fetchPublicSettings: async () => {
    try {
      const { data } = await api.get('/settings/')
      set(s => ({ settings: { ...s.settings, ...data }, loaded: true }))
    } catch {
      set({ loaded: true })
    }
  },

  fetchSettings: async () => {
    try {
      const { data } = await api.get('/admin/settings/')
      set({ settings: data, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  updateSettings: async (patch) => {
    const { data } = await api.patch('/admin/settings/', patch)
    set({ settings: data })
    return data
  },
}))

export default useSettingsStore
