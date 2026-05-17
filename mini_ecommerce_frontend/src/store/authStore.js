import { create } from 'zustand'
import api from '@/api/axios'

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  accessToken: localStorage.getItem('access_token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.post('/auth/login/', { email, password })

      // 2FA required — do NOT store tokens yet
      if (data.requires_2fa) {
        set({ isLoading: false })
        return { requires_2fa: true, two_fa_token: data['2fa_token'] }
      }

      get()._persistAuth(data)
      set({ isLoading: false })
      return { requires_2fa: false }
    } catch (err) {
      const error = err.response?.data || { error: 'Login failed.' }
      set({ isLoading: false, error })
      throw err
    }
  },

  confirmTwoFA: async (twoFaToken, code) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.post('/auth/2fa/confirm/', {
        '2fa_token': twoFaToken,
        code,
      })
      get()._persistAuth(data)
      set({ isLoading: false })
    } catch (err) {
      const error = err.response?.data || { error: '2FA confirmation failed.' }
      set({ isLoading: false, error })
      throw err
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    try {
      if (refreshToken) {
        await api.post('/auth/logout/', { refresh: refreshToken })
      }
    } catch {
      // Proceed with local logout even if API call fails
    } finally {
      get()._clearAuth()
      // Reset cart and wishlist back to guest state (localStorage)
      const { default: useCartStore } = await import('@/store/cartStore')
      const { default: useWishlistStore } = await import('@/store/wishlistStore')
      useCartStore.getState().resetToGuestCart()
      useWishlistStore.getState().resetToGuestWishlist()
    }
  },

  updateUser: (userData) => {
    const updated = { ...get().user, ...userData }
    localStorage.setItem('user', JSON.stringify(updated))
    set({ user: updated })
  },

  clearError: () => set({ error: null }),

  isAuthenticated: () => !!get().accessToken,

  isAdmin: () => ['admin', 'superadmin'].includes(get().user?.role),

  isSuperAdmin: () => get().user?.role === 'superadmin',

  // Internal helpers
  _persistAuth: (data) => {
    const user = {
      id: data.id,
      email: data.email,
      role: data.role,
      first_name: data.first_name || '',
      avatar: data.avatar_url || null,
    }
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, accessToken: data.access, refreshToken: data.refresh })
  },

  _clearAuth: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    set({ user: null, accessToken: null, refreshToken: null })
  },
}))

export default useAuthStore
