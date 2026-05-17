import { Outlet, useLocation, Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Sun, Moon } from 'lucide-react'
import AdminSidebar from '@/components/shared/AdminSidebar'
import MobileAdminNav from '@/components/shared/MobileAdminNav'
import useThemeStore from '@/store/themeStore'
import useAuthStore from '@/store/authStore'
import useSettingsStore from '@/store/settingsStore'
import { useEffect } from 'react'

export default function AdminLayout() {
  const { theme, toggle } = useThemeStore()
  const { user } = useAuthStore()
  const { fetchSettings } = useSettingsStore()

  useEffect(() => { fetchSettings() }, [])

  // Breadcrumb: derive page title from pathname
  const location = useLocation()
  const segment = location.pathname.split('/').filter(Boolean).at(-1) || 'dashboard'
  const pageTitle = segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <AdminSidebar />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile nav trigger */}
            <Sheet>
              <SheetTrigger className="lg:hidden flex items-center justify-center size-8 rounded-lg hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <MobileAdminNav />
              </SheetContent>
            </Sheet>
            <h1 className="font-semibold text-base sm:text-lg">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-muted-foreground">
              {user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
