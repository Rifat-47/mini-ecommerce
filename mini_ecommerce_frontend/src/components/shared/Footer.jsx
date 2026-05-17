import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import useSettingsStore from '@/store/settingsStore'
import useAuthStore from '@/store/authStore'

export default function Footer() {
  const year = new Date().getFullYear()
  const storeName = useSettingsStore(s => s.settings.store_name)
  const { isAuthenticated } = useAuthStore()

  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary mb-3">
              <Package className="h-5 w-5" />
              {storeName}
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your one-stop shop for quality products. Fast delivery, easy returns, and secure payments via bKash, Nagad & Rocket.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Shop</h3>
            <ul className="space-y-2">
              {[
                { label: 'All Products', to: '/' },
                { label: 'My Cart', to: '/cart' },
                { label: 'My Orders', to: '/orders' },
                { label: 'Wishlist', to: '/wishlist' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Account</h3>
            <ul className="space-y-2">
              {[
                !isAuthenticated() && { label: 'Login', to: '/login' },
                !isAuthenticated() && { label: 'Register', to: '/register' },
                { label: 'Profile', to: '/profile' },
                { label: 'Privacy & Data', to: '/profile' },
              ].filter(Boolean).map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {year} {storeName}. All rights reserved.</p>
          <p>Payments powered by ShurjoPay — bKash · Nagad · Rocket</p>
        </div>
      </div>
    </footer>
  )
}
