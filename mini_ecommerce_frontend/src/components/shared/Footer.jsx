import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import useSettingsStore from '@/store/settingsStore'
import useAuthStore from '@/store/authStore'

export default function Footer() {
  const year = new Date().getFullYear()
  const storeName = useSettingsStore(s => s.settings.store_name)
  const { isAuthenticated } = useAuthStore()

  return (
    <footer className="bg-card border-t border-border mt-auto">
      {/* Top gradient accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary">
              <ShoppingBag className="h-5 w-5" />
              {storeName}
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Your one-stop shop for quality products. Fast delivery, easy returns, and secure payments via bKash, Nagad &amp; Rocket.
            </p>
            {/* Payment badges */}
            <div className="flex flex-wrap gap-2">
              {['bKash', 'Nagad', 'Rocket', 'Card'].map((method) => (
                <span
                  key={method}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/8 text-primary border border-primary/15"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-semibold text-sm mb-4 text-foreground">Shop</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'All Products', to: '/' },
                { label: 'My Cart', to: '/cart' },
                { label: 'My Orders', to: '/orders' },
                { label: 'Wishlist', to: '/wishlist' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold text-sm mb-4 text-foreground">Account</h3>
            <ul className="space-y-2.5">
              {[
                !isAuthenticated() && { label: 'Login', to: '/login' },
                !isAuthenticated() && { label: 'Register', to: '/register' },
                { label: 'My Profile', to: '/profile' },
                { label: 'Privacy & Data', to: '/profile' },
              ].filter(Boolean).map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© {year} {storeName}. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Payments powered by{' '}
            <span className="font-medium text-foreground">ShurjoPay</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
