import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ShoppingBag, Sun, Moon, ArrowRight, Truck, Shield, RotateCcw, Zap } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import useThemeStore from '@/store/themeStore'

const FEATURES = [
  {
    icon: Truck,
    title: 'Fast Delivery',
    description: 'Same-day dispatch on orders placed before 3 PM.',
  },
  {
    icon: Shield,
    title: 'Secure Payments',
    description: 'Powered by ShurjoPay — bKash, Nagad, Rocket & cards.',
  },
  {
    icon: RotateCcw,
    title: 'Easy Returns',
    description: 'Hassle-free returns within 7 days, no questions asked.',
  },
  {
    icon: Zap,
    title: 'Instant Updates',
    description: 'Real-time order tracking and instant notifications.',
  },
]

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
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-lg text-primary">
          <ShoppingBag className="h-5 w-5" />
          <span>Shoply</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Link
            to="/auth/login"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Platform Login
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-accent/40 to-background pointer-events-none" />
          {/* Decorative blobs */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-primary/5 blur-2xl pointer-events-none" />

          <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-6 border border-primary/20">
              <Zap className="h-3 w-3" />
              Multi-store e-commerce platform
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-foreground mb-5 leading-tight">
              Discover &amp; Shop<br />
              <span className="text-primary">Your Favourite Store</span>
            </h1>

            <p className="text-muted-foreground text-lg sm:text-xl max-w-xl mx-auto mb-10">
              Each store on Shoply has its own unique link. Enter your store name below or use the link shared by your store.
            </p>

            {/* Store entry form */}
            <form
              onSubmit={handleVisit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none pointer-events-none">
                  shoply.com/
                </span>
                <Input
                  placeholder="your-store-name"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="pl-[6.5rem] h-11 bg-background"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={!slug.trim()} className="h-11 px-6 gap-2 shrink-0">
                Visit Store <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-5 text-sm text-muted-foreground">
              Store owner?{' '}
              <Link to="/auth/login" className="text-primary font-medium hover:underline">
                Sign in to your admin panel →
              </Link>
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-center text-2xl font-bold text-foreground mb-2">
            Why choose Shoply?
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Everything you need for a seamless shopping experience.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Shoply Platform
          </div>
          <p>© {new Date().getFullYear()} Shoply. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
