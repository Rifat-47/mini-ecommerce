import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Package, Store, Sun, Moon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import useThemeStore from '@/store/themeStore'

export default function LandingPage() {
  const [slug, setSlug] = useState('')
  const navigate = useNavigate()
  const { theme, toggle } = useThemeStore()

  function handleVisit(e) {
    e.preventDefault()
    const s = slug.trim().toLowerCase()
    if (s) navigate(`/${s}/`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 h-16 border-b border-border">
        <div className="flex items-center gap-2 font-bold text-primary">
          <Package className="h-5 w-5" />
          <span>Shoply Platform</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Link to="/auth/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Platform Login</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-8">
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-primary/10">
                <Store className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold">Welcome to Shoply</h1>
            <p className="text-muted-foreground">
              This is a multi-store platform. Each store has its own link.
              Enter your store name below or use the link provided by your store.
            </p>
          </div>

          <form onSubmit={handleVisit} className="flex gap-2">
            <Input
              placeholder="your-store-name"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button type="submit" disabled={!slug.trim()}>
              Visit Store
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Store owners —{' '}
            <Link to="/auth/login" className="text-primary hover:underline">
              sign in to your admin panel
            </Link>
          </p>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground py-4 border-t border-border">
        © {new Date().getFullYear()} Shoply Platform. All rights reserved.
      </footer>
    </div>
  )
}
