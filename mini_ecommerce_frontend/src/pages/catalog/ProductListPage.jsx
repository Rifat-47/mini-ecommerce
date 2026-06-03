import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X, Package, Truck, RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import ProductCard from '@/components/shared/ProductCard'
import Pagination from '@/components/shared/Pagination'
import EmptyState from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import api from '@/api/axios'
import useSettingsStore from '@/store/settingsStore'

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating',     label: 'Top Rated' },
  { value: 'popularity', label: 'Most Popular' },
]

const TRUST_BADGES = [
  { icon: Truck,       label: 'Fast Delivery' },
  { icon: RotateCcw,   label: '7-Day Returns' },
  { icon: ShieldCheck, label: 'Secure Payments' },
]

function FilterPanel({ params, onParamChange, onReset }) {
  const [minPrice, setMinPrice] = useState(params.min_price)
  const [maxPrice, setMaxPrice] = useState(params.max_price)

  useEffect(() => { setMinPrice(params.min_price) }, [params.min_price])
  useEffect(() => { setMaxPrice(params.max_price) }, [params.max_price])

  function commitMin() { onParamChange('min_price', minPrice) }
  function commitMax() { onParamChange('max_price', maxPrice) }
  function handlePriceKeyDown(e, commit) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">Price Range</h3>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onBlur={commitMin}
            onKeyDown={(e) => handlePriceKeyDown(e, commitMin)}
            className="h-9 text-sm"
            min={0}
          />
          <span className="text-muted-foreground text-sm shrink-0">–</span>
          <Input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onBlur={commitMax}
            onKeyDown={(e) => handlePriceKeyDown(e, commitMax)}
            className="h-9 text-sm"
            min={0}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="in-stock"
          checked={params.in_stock === 'true'}
          onCheckedChange={(checked) => onParamChange('in_stock', checked ? 'true' : '')}
        />
        <Label htmlFor="in-stock" className="text-sm font-normal cursor-pointer">
          In stock only
        </Label>
      </div>

      <Button variant="outline" size="sm" onClick={onReset} className="w-full">
        Reset filters
      </Button>
    </div>
  )
}

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts]         = useState([])
  const [categories, setCategories]     = useState([])
  const [pagination, setPagination]     = useState({ count: 0, next: null, previous: null })
  const [loading, setLoading]           = useState(true)
  const [suggestions, setSuggestions]   = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchInput, setSearchInput]   = useState(searchParams.get('search') || '')
  const suggestionsRef   = useRef(null)
  const searchDebounceRef = useRef(null)
  const storeName = useSettingsStore(s => s.settings.store_name)

  const params = {
    search:    searchParams.get('search')    || '',
    category:  searchParams.get('category')  || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    in_stock:  searchParams.get('in_stock')  || '',
    sort:      searchParams.get('sort')      || 'newest',
    page:      searchParams.get('page')      || '1',
  }

  function setParam(key, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) { next.set(key, value) } else { next.delete(key) }
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  function resetFilters() {
    setSearchParams({})
    setSearchInput('')
  }

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (params.search)    query.set('search',    params.search)
      if (params.category)  query.set('category',  params.category)
      if (params.min_price) query.set('min_price', params.min_price)
      if (params.max_price) query.set('max_price', params.max_price)
      if (params.in_stock)  query.set('in_stock',  params.in_stock)
      if (params.sort)      query.set('sort',      params.sort)
      if (params.page && params.page !== '1') query.set('page', params.page)
      const { data } = await api.get(`/products/?${query}`)
      setProducts(data.results ?? [])
      setPagination({ count: data.count, next: data.next, previous: data.previous })
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    api.get('/categories/').then(({ data }) => {
      const list = data.results ?? data
      setCategories(Array.isArray(list) ? list : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setSearchInput(searchParams.get('search') || '')
  }, [searchParams.get('search')])

  useEffect(() => {
    function handleClickOutside(e) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSearchInputChange(value) {
    setSearchInput(value)
    clearTimeout(searchDebounceRef.current)
    if (value.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/products/search/suggestions/?q=${encodeURIComponent(value)}`)
        setSuggestions(data)
        setShowSuggestions(true)
      } catch { setSuggestions([]) }
    }, 300)
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    setShowSuggestions(false)
    setParam('search', searchInput)
  }

  function applySuggestion(suggestion) {
    setSearchInput(suggestion.name)
    setShowSuggestions(false)
    setParam('search', suggestion.name)
  }

  const activeFiltersCount = [params.category, params.min_price, params.max_price, params.in_stock].filter(Boolean).length
  const isFiltered = !!(params.search || params.category || params.min_price || params.max_price || params.in_stock)

  return (
    <div>
      {/* ── Hero Banner ──────────────────────────────────────── */}
      {!isFiltered && (
        <div className="relative overflow-hidden rounded-2xl mb-8 bg-gradient-to-br from-primary via-[oklch(0.46_0.24_272)] to-[oklch(0.36_0.20_285)]">
          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '28px 28px' }}
          />
          {/* Glow blobs */}
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />

          <div className="relative z-10 px-6 sm:px-10 py-10 sm:py-14">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Welcome to</p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 leading-tight">
              {storeName || 'Our Store'}
            </h1>
            <p className="text-white/70 text-base sm:text-lg max-w-lg mb-8">
              Discover quality products with fast delivery and secure payments.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3 sm:gap-5">
              {TRUST_BADGES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-2">
                  <Icon className="h-4 w-4 text-white/80 shrink-0" />
                  <span className="text-white/90 text-xs font-medium">{label}</span>
                </div>
              ))}
              {!loading && pagination.count > 0 && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-2">
                  <Package className="h-4 w-4 text-white/80 shrink-0" />
                  <span className="text-white/90 text-xs font-medium">{pagination.count}+ Products</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Category Pills ───────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          <button
            onClick={() => setParam('category', '')}
            className={cn(
              'flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all duration-150 shrink-0',
              !params.category
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setParam('category', params.category === String(cat.id) ? '' : String(cat.id))}
              className={cn(
                'flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all duration-150 shrink-0',
                params.category === String(cat.id)
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Search + Sort bar ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
        <div className="relative flex-1 max-w-md" ref={suggestionsRef}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search products..."
              value={searchInput}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-9 pr-9 bg-card"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); setParam('search', ''); setSuggestions([]); setShowSuggestions(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onMouseDown={() => applySuggestion(s)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent text-left gap-4"
                >
                  <span className="truncate">{s.name}</span>
                  <span className="text-muted-foreground shrink-0">৳{parseFloat(s.price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={params.sort} onValueChange={(v) => setParam('sort', v)}>
            <SelectTrigger className="w-full sm:w-48 bg-card">
              <SelectValue>
                {SORT_OPTIONS.find((o) => o.value === params.sort)?.label ?? 'Sort by'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mobile filter sheet */}
          <Sheet>
            <SheetTrigger className="relative lg:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted transition-colors shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 text-[10px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterPanel params={params} onParamChange={setParam} onReset={resetFilters} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex gap-8">
        {/* Desktop sidebar — price + stock only */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="bg-card border border-border rounded-xl p-5 sticky top-24">
            <h2 className="font-semibold text-sm mb-5 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Filters
            </h2>
            <FilterPanel params={params} onParamChange={setParam} onReset={resetFilters} />
          </div>
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {!loading && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{pagination.count}</span>{' '}
                product{pagination.count !== 1 ? 's' : ''}
                {params.search && <> for "<span className="font-medium text-primary">{params.search}</span>"</>}
              </p>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <Skeleton className="aspect-square w-full" />
                  <div className="p-4 space-y-2.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-9 w-full mt-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products found"
              message="Try adjusting your filters or search term."
              action={{ label: 'Reset filters', onClick: resetFilters }}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="mt-8">
                <Pagination
                  count={pagination.count}
                  page={parseInt(params.page)}
                  pageSize={12}
                  onPageChange={(p) => setParam('page', String(p))}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
