import { create } from 'zustand'
import api from '@/api/axios'

const STORAGE_KEY = 'guest_cart'

function loadGuestCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveGuestCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function _isLoggedIn() {
  return !!localStorage.getItem('access_token')
}

const useCartStore = create((set, get) => ({
  items: loadGuestCart(),
  isSyncing: false,

  addItem: async (product, quantity = 1) => {
    if (_isLoggedIn()) {
      const { data } = await api.post('/cart/', { product: product.id, quantity })
      get().addBackendCartItem(
        data,
        product.images?.find((img) => img.is_primary)?.image || null,
      )
      return
    }

    const items = get().items
    const existing = items.find((i) => i.product_id === product.id)
    let updated
    if (existing) {
      updated = items.map((i) =>
        i.product_id === product.id
          ? { ...i, quantity: i.quantity + quantity }
          : i,
      )
    } else {
      updated = [
        ...items,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          discount_percentage: product.discount_percentage || '0.00',
          stock: product.stock,
          category_id: product.category || null,
          image: product.images?.find((img) => img.is_primary)?.image || null,
          quantity,
        },
      ]
    }
    saveGuestCart(updated)
    set({ items: updated })
  },

  removeItem: async (productId) => {
    if (_isLoggedIn()) {
      const snapshot = get().items
      set({ items: snapshot.filter((i) => i.product_id !== productId) })
      const item = snapshot.find((i) => i.product_id === productId)
      if (item?.cartItemId) {
        try {
          await api.delete(`/cart/${item.cartItemId}/`)
        } catch (err) {
          set({ items: snapshot })
          throw err
        }
      }
      return
    }

    const updated = get().items.filter((i) => i.product_id !== productId)
    saveGuestCart(updated)
    set({ items: updated })
  },

  updateQuantity: async (productId, quantity) => {
    if (quantity < 1) return get().removeItem(productId)

    if (_isLoggedIn()) {
      const snapshot = get().items
      set({
        items: snapshot.map((i) =>
          i.product_id === productId ? { ...i, quantity } : i,
        ),
      })
      const item = snapshot.find((i) => i.product_id === productId)
      if (item?.cartItemId) {
        try {
          await api.patch(`/cart/${item.cartItemId}/`, { quantity })
        } catch (err) {
          set({ items: snapshot })
          throw err
        }
      }
      return
    }

    const updated = get().items.map((i) =>
      i.product_id === productId ? { ...i, quantity } : i,
    )
    saveGuestCart(updated)
    set({ items: updated })
  },

  clearCart: async () => {
    if (_isLoggedIn()) {
      const snapshot = get().items
      set({ items: [] })
      try {
        await api.delete('/cart/')
      } catch (err) {
        set({ items: snapshot })
        throw err
      }
      return
    }
    saveGuestCart([])
    set({ items: [] })
  },

  getTotal: () => {
    return get().items.reduce((sum, item) => {
      const price = parseFloat(item.price)
      const discount = parseFloat(item.discount_percentage || 0)
      const effectivePrice = price * (1 - discount / 100)
      return sum + effectivePrice * item.quantity
    }, 0)
  },

  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  // Called after a backend-side cart operation (e.g. move from wishlist):
  // inserts or updates a cart item using the CartItemSerializer response shape.
  // Does NOT write to localStorage — authenticated cart lives in memory only.
  addBackendCartItem: (backendItem, image = null) => {
    image = image ?? backendItem.product_image ?? null
    const items = get().items
    const existing = items.find((i) => i.product_id === backendItem.product)
    let updated
    if (existing) {
      updated = items.map((i) =>
        i.product_id === backendItem.product
          ? { ...i, quantity: backendItem.quantity, cartItemId: backendItem.id }
          : i,
      )
    } else {
      updated = [
        ...items,
        {
          product_id: backendItem.product,
          name: backendItem.product_name,
          price: backendItem.product_price,
          discount_percentage: backendItem.product_discount_percentage,
          stock: backendItem.product_stock,
          image,
          quantity: backendItem.quantity,
          cartItemId: backendItem.id,
        },
      ]
    }
    set({ items: updated })
  },

  // Called on login: merge LocalStorage cart with backend cart
  syncOnLogin: async () => {
    set({ isSyncing: true })
    try {
      const { data: backendCart } = await api.get('/cart/')
      const localItems = get().items
      let finalCart = backendCart

      if (localItems.length > 0) {
        const backendProductIds = new Set(backendCart.items.map((i) => i.product))
        const localOnlyItems = localItems.filter(
          (i) => !backendProductIds.has(i.product_id),
        )
        if (localOnlyItems.length > 0) {
          await Promise.allSettled(
            localOnlyItems.map((item) =>
              api.post('/cart/', { product: item.product_id, quantity: item.quantity }),
            ),
          )
          // Re-fetch only when we pushed new items
          const { data } = await api.get('/cart/')
          finalCart = data
        }
      }

      const syncedItems = finalCart.items.map((item) => ({
        product_id: item.product,
        name: item.product_name,
        price: item.product_price,
        discount_percentage: item.product_discount_percentage,
        stock: item.product_stock,
        image: item.product_image || null,
        quantity: item.quantity,
        cartItemId: item.id,
      }))

      saveGuestCart([])
      set({ items: syncedItems })
    } catch {
      // Sync failed silently — guest cart remains usable
    } finally {
      set({ isSyncing: false })
    }
  },

  // Called on logout — reload guest cart from localStorage (likely empty after sync)
  resetToGuestCart: () => {
    set({ items: loadGuestCart() })
  },
}))

export default useCartStore
