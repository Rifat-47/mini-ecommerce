import { Link } from 'react-router-dom'
import { ShoppingBag, Mail, Phone, MapPin } from 'lucide-react'
import useSettingsStore from '@/store/settingsStore'
import useAuthStore from '@/store/authStore'

export default function Footer() {
  const year      = new Date().getFullYear()
  const settings  = useSettingsStore(s => s.settings)
  const storeName = settings.store_name
  const { isAuthenticated } = useAuthStore()

  return (
    <footer className="mt-auto bg-foreground text-background dark:bg-card dark:text-foreground dark:border-t dark:border-border">
      {/* Top gradient accent */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary/60 via-primary to-[oklch(0.58_0.22_285)]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 font-extrabold text-lg">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shadow-sm shadow-primary/40">
                <ShoppingBag className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-gradient">{storeName}</span>
            </Link>
            <p className="text-sm opacity-60 max-w-xs leading-relaxed">
              Your one-stop shop for quality products. Fast delivery, easy returns, and secure payments via bKash, Nagad &amp; Rocket.
            </p>

            {/* Contact info */}
            <div className="space-y-1.5">
              {settings.support_email && (
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>{settings.support_email}</span>
                </div>
              )}
              {settings.contact_phone && (
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{settings.contact_phone}</span>
                </div>
              )}
            </div>

            {/* Payment badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {['bKash', 'Nagad', 'Rocket', 'Card'].map((method) => (
                <span
                  key={method}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/15 text-primary border border-primary/25"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-widest mb-5 opacity-40">Shop</h3>
            <ul className="space-y-3">
              {[
                { label: 'All Products', to: '/' },
                { label: 'My Cart',      to: '/cart' },
                { label: 'My Orders',    to: '/orders' },
                { label: 'Wishlist',     to: '/wishlist' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm opacity-60 hover:opacity-100 hover:text-primary transition-all duration-150">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-widest mb-5 opacity-40">Account</h3>
            <ul className="space-y-3">
              {[
                !isAuthenticated() && { label: 'Login',       to: '/login' },
                !isAuthenticated() && { label: 'Register',    to: '/register' },
                { label: 'My Profile',  to: '/profile' },
                { label: 'Privacy & Data', to: '/profile' },
              ].filter(Boolean).map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm opacity-60 hover:opacity-100 hover:text-primary transition-all duration-150">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-current/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-40">
          <p>© {year} {storeName}. All rights reserved.</p>
          <p>Payments powered by <span className="font-semibold opacity-80">ShurjoPay</span></p>
        </div>
      </div>
    </footer>
  )
}
