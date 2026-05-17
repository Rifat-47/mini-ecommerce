import { create } from 'zustand'
import api from '@/api/axios'

const STORAGE_KEY = 'guest_wishlist'

function loadGuestWishlist() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveGuestWishlist(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

const useWishlistStore = create((set, get) => ({
  items: loadGuestWishlist(),
  isSyncing: false,

  isInWishlist: (productId) =>
    get().items.some((i) => i.product_id === productId),

  // Add to guest wishlist (LocalStorage only — used when not logged in)
  addItem: (product) => {
    if (get().isInWishlist(product.id)) return
    const updated = [
      ...get().items,
      {
        product_id: product.id,
        name: product.name,
        price: product.price,
        discount_percentage: product.discount_percentage || '0.00',
        stock: product.stock,
        image: product.images?.find((img) => img.is_primary)?.image || null,
        wishlist_item_id: null, // set after backend sync
      },
    ]
    saveGuestWishlist(updated)
    set({ items: updated })
  },

  // Remove from guest wishlist (LocalStorage only — used when not logged in)
  removeItem: (productId) => {
    const updated = get().items.filter((i) => i.product_id !== productId)
    saveGuestWishlist(updated)
    set({ items: updated })
  },

  // Called on login: push local wishlist items to backend, then fetch backend wishlist
  syncOnLogin: async () => {
    set({ isSyncing: true })
    try {
      const { data: backendRaw } = await api.get('/wishlist/')
      const backendWishlist = backendRaw.results ?? backendRaw
      const localItems = get().items

      // Push local-only items to backend
      if (localItems.length > 0) {
        const backendProductIds = new Set(backendWishlist.map((i) => i.product))
        const localOnly = localItems.filter((i) => !backendProductIds.has(i.product_id))

        await Promise.allSettled(
          localOnly.map((item) => api.post('/wishlist/', { product: item.product_id })),
        )
      }

      // Re-fetch final backend state and use it as source of truth
      const { data: finalRaw } = await api.get('/wishlist/')
      const finalWishlist = finalRaw.results ?? finalRaw
      const synced = finalWishlist.map((item) => ({
        product_id: item.product,
        name: item.product_name,
        price: item.product_price,
        discount_percentage: item.product_discount_percentage,
        stock: item.product_stock,
        image: item.product_image || null,
        wishlist_item_id: item.id, // backend ID needed for DELETE
      }))

      saveGuestWishlist([])
      set({ items: synced })
    } catch {
      // Sync failed silently — local wishlist remains usable
    } finally {
      set({ isSyncing: false })
    }
  },

  // Remove from backend wishlist (used when logged in) — optimistic update
  removeFromBackend: async (productId) => {
    const item = get().items.find((i) => i.product_id === productId)
    if (!item?.wishlist_item_id) {
      get().removeItem(productId)
      return
    }

    // Optimistically remove immediately
    const snapshot = get().items
    set({ items: snapshot.filter((i) => i.product_id !== productId) })

    try {
      await api.delete(`/wishlist/${item.wishlist_item_id}/`)
    } catch (err) {
      // Rollback on failure and let caller handle the error
      set({ items: snapshot })
      throw err
    }
  },

  // Add to backend wishlist (used when logged in) — optimistic update
  addToBackend: async (product) => {
    if (get().isInWishlist(product.id)) return

    // Optimistically add immediately so UI responds instantly
    const optimisticItem = {
      product_id: product.id,
      name: product.name,
      price: product.price,
      discount_percentage: product.discount_percentage || '0.00',
      stock: product.stock,
      image: product.images?.find((img) => img.is_primary)?.image || null,
      wishlist_item_id: null,
    }
    set((state) => ({ items: [...state.items, optimisticItem] }))

    try {
      const { data } = await api.post('/wishlist/', { product: product.id })
      // Patch in the real wishlist_item_id from the backend
      set((state) => ({
        items: state.items.map((i) =>
          i.product_id === product.id ? { ...i, wishlist_item_id: data.id } : i,
        ),
      }))
    } catch {
      // Rollback on failure
      set((state) => ({ items: state.items.filter((i) => i.product_id !== product.id) }))
      throw new Error('Failed to add to wishlist')
    }
  },

  // Called on logout — reload guest wishlist (likely empty after sync)
  resetToGuestWishlist: () => {
    set({ items: loadGuestWishlist() })
  },

  clearWishlist: () => {
    saveGuestWishlist([])
    set({ items: [] })
  },
}))

export default useWishlistStore
