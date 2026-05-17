import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ShoppingCart, Bell, Sun, Moon, Menu, Search, X, LogOut, User, Heart, Package, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useAuthStore from '@/store/authStore'
import useCartStore from '@/store/cartStore'
import useWishlistStore from '@/store/wishlistStore'
import useNotificationStore from '@/store/notificationStore'
import useThemeStore from '@/store/themeStore'
import useSettingsStore from '@/store/settingsStore'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, accessToken, logout } = useAuthStore()
  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const wishlistCount = useWishlistStore((s) => s.items.length)
  const { unreadCount, notifications, isLoading, fetchUnreadCount, fetchNotifications, markRead, markAllRead } = useNotificationStore()
  const { theme, toggle } = useThemeStore()
  const storeName = useSettingsStore(s => s.settings.store_name)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)
  const searchRef = useRef(null)

  // Poll unread notification count every 60s when logged in
  useEffect(() => {
    if (!accessToken) return
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [accessToken, fetchUnreadCount])

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  // Fetch notifications when panel opens
  useEffect(() => {
    if (notifOpen) fetchNotifications()
  }, [notifOpen])

  // Close notification panel on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Keep navbar search in sync with URL ?search param (e.g. when user searches from product page)
  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '')
  }, [searchParams.get('search')])

  function handleSearch(e) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`)
    setSearchOpen(false)
  }

  function handleSearchClear() {
    setSearchQuery('')
    if (location.pathname === '/') navigate('/')
  }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.email?.[0] || ''}`.toUpperCase()
    : ''

  const isAdmin = ['admin', 'superadmin'].includes(user?.role)

  const navLinks = [
    { label: 'Products', to: '/' },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-xl text-primary shrink-0"
          >
            <Package className="h-6 w-6" />
            <span className="hidden sm:inline">{storeName}</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Desktop search bar */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-sm items-center gap-2"
          >
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-secondary border-0 focus-visible:ring-1"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>

          {/* Right icons */}
          <div className="flex items-center gap-1">

            {/* Mobile search toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Toggle search"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {theme === 'dark'
                ? <Sun className="h-5 w-5" />
                : <Moon className="h-5 w-5" />}
            </Button>

            {/* Wishlist (logged in only) */}
            {accessToken && (
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate('/wishlist')}
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary">
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </Badge>
                )}
              </Button>
            )}

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => navigate('/cart')}
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary">
                  {cartCount > 99 ? '99+' : cartCount}
                </Badge>
              )}
            </Button>

            {/* Notifications (logged in only) */}
            {accessToken && (
              <div className="relative" ref={notifRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </Button>

                {/* Notification panel */}
                {notifOpen && (
                  <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-[4.5rem] sm:top-full sm:right-0 sm:mt-2 sm:w-96 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <span className="font-semibold text-sm">Notifications</span>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="text-xs text-primary hover:underline"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={() => setNotifOpen(false)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                          aria-label="Close notifications"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
                      {isLoading ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
                      ) : notifications.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">No notifications yet.</div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => !n.is_read && markRead(n.id)}
                            className={`w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors ${
                              n.is_read ? 'bg-popover hover:bg-accent/50' : 'bg-primary/5 hover:bg-primary/10'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                              <div className={`flex-1 min-w-0 ${n.is_read ? 'pl-4' : ''}`}>
                                <p className="text-sm font-medium leading-snug">{n.title || n.message}</p>
                                {n.title && n.message && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User menu (desktop) */}
            {accessToken ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="hidden md:flex items-center gap-2 pl-2 pr-3 rounded-lg hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 transition-colors">
                  <Avatar className="h-7 w-7">
                    {user?.avatar && <AvatarImage src={user.avatar} alt={user.first_name || user.email} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium max-w-[100px] truncate">
                    {user?.first_name || user?.email}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/orders')}>
                    <Package className="mr-2 h-4 w-4" /> My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/wishlist')}>
                    <Heart className="mr-2 h-4 w-4" /> Wishlist
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/admin')}>
                        Admin Panel
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  Login
                </Button>
                <Button size="sm" onClick={() => navigate('/register')}>
                  Sign Up
                </Button>
              </div>
            )}

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger className="md:hidden flex items-center justify-center size-8 rounded-lg hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <div className="flex flex-col h-full">
                  {/* Mobile menu header */}
                  <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
                    {accessToken ? (
                      <>
                        <Avatar className="h-10 w-10">
                          {user?.avatar && <AvatarImage src={user.avatar} alt={user.first_name || user.email} />}
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{user?.first_name || 'User'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{user?.email}</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2 w-full">
                        <Button className="flex-1" onClick={() => navigate('/login')}>Login</Button>
                        <Button variant="outline" className="flex-1" onClick={() => navigate('/register')}>Sign Up</Button>
                      </div>
                    )}
                  </div>

                  {/* Mobile search */}
                  <form onSubmit={handleSearch} className="px-4 py-3 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-9"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={handleSearchClear}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label="Clear search"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Mobile nav links */}
                  <nav className="flex-1 px-4 py-4 space-y-1">
                    <MobileNavLink to="/" icon={<Package className="h-4 w-4" />} label="Products" />
                    {accessToken && (
                      <>
                        <MobileNavLink to="/orders" icon={<Package className="h-4 w-4" />} label="My Orders" />
                        <MobileNavLink to="/wishlist" icon={<Heart className="h-4 w-4" />} label="Wishlist" />
                        <MobileNavLink to="/profile" icon={<User className="h-4 w-4" />} label="Profile" />
                      </>
                    )}
                    {isAdmin && (
                      <MobileNavLink to="/admin" icon={<Package className="h-4 w-4" />} label="Admin Panel" />
                    )}
                  </nav>

                  {/* Mobile logout */}
                  {accessToken && (
                    <div className="px-4 py-4 border-t border-border">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleLogout}
                      >
                        <LogOut className="mr-2 h-4 w-4" /> Logout
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile search bar (expandable) */}
        {searchOpen && (
          <div className="md:hidden pb-3">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleSearchClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </header>
  )
}

function MobileNavLink({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-secondary transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </Link>
  )
}
