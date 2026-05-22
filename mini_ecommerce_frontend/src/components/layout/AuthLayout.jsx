import { Outlet, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { ShoppingBag, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useThemeStore from '@/store/themeStore'
import useSettingsStore from '@/store/settingsStore'

export default function AuthLayout() {
  const { theme, toggle } = useThemeStore()
  const { fetchPublicSettings, settings } = useSettingsStore()
  const storeName = settings.store_name

  useEffect(() => { fetchPublicSettings() }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Subtle background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/6 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/4 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="relative flex items-center justify-between px-6 h-16 border-b border-border bg-background/80 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2 font-bold text-primary">
          <ShoppingBag className="h-5 w-5" />
          {storeName}
        </Link>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </header>

      {/* Centered card */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>

      <footer className="relative text-center text-xs text-muted-foreground py-4 border-t border-border">
        © {new Date().getFullYear()} {storeName}. All rights reserved.
      </footer>
    </div>
  )
}
