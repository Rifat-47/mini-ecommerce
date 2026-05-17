import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import router from '@/router'
import useThemeStore from '@/store/themeStore'
import useAuthStore from '@/store/authStore'
import useCartStore from '@/store/cartStore'
import useWishlistStore from '@/store/wishlistStore'
import ErrorBoundary from '@/components/shared/ErrorBoundary'

export default function App() {
  const init = useThemeStore((s) => s.init)
  const theme = useThemeStore((s) => s.theme)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const syncCart = useCartStore((s) => s.syncOnLogin)
  const syncWishlist = useWishlistStore((s) => s.syncOnLogin)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    if (isAuthenticated()) {
      syncCart()
      syncWishlist()
    }
  }, [])

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster theme={theme} richColors position="top-right" />
    </ErrorBoundary>
  )
}
