import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import ProductCard from '@/components/shared/ProductCard'
import Pagination from '@/components/shared/Pagination'
import EmptyState from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/api/axios'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'popularity', label: 'Most Popular' },
]

function FilterPanel({ categories, params, onParamChange, onReset }) {
  const [minPrice, setMinPrice] = useState(params.min_price)
  const [maxPrice, setMaxPrice] = useState(params.max_price)

  // Sync local fields when URL params are cleared externally (e.g. Reset filters)
  useEffect(() => { setMinPrice(params.min_price) }, [params.min_price])
  useEffect(() => { setMaxPrice(params.max_price) }, [params.max_price])

  function commitMin() { onParamChange('min_price', minPrice) }
  function commitMax() { onParamChange('max_price', maxPrice) }

  function handlePriceKeyDown(e, commit) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
  }

  return (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <h3 className="font-medium text-sm mb-3">Category</h3>
        <TooltipProvider>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 min-w-0">
                <Checkbox
                  id={`cat-${cat.id}`}
                  checked={params.category === String(cat.id)}
                  onCheckedChange={(checked) =>
                    onParamChange('category', checked ? String(cat.id) : '')
                  }
                />
                <Tooltip content={cat.name.length > 22 ? cat.name : undefined}>
                  <Label htmlFor={`cat-${cat.id}`} className="text-sm font-normal cursor-pointer truncate min-w-0">
                    {cat.name}
                  </Label>
                </Tooltip>
              </div>
            ))}
          </div>
        </TooltipProvider>
      </div>

      {/* Price range */}
      <div>
        <h3 className="font-medium text-sm mb-3">Price Range</h3>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onBlur={commitMin}
            onKeyDown={(e) => handlePriceKeyDown(e, commitMin)}
            className="h-8 text-sm"
            min={0}
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onBlur={commitMax}
            onKeyDown={(e) => handlePriceKeyDown(e, commitMax)}
            className="h-8 text-sm"
            min={0}
          />
        </div>
      </div>

      {/* In stock */}
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
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null })
  const [loading, setLoading] = useState(true)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const suggestionsRef = useRef(null)
  const searchDebounceRef = useRef(null)

  const params = {
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    in_stock: searchParams.get('in_stock') || '',
    sort: searchParams.get('sort') || 'newest',
    page: searchParams.get('page') || '1',
  }

  function setParam(key, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
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
      if (params.search) query.set('search', params.search)
      if (params.category) query.set('category', params.category)
      if (params.min_price) query.set('min_price', params.min_price)
      if (params.max_price) query.set('max_price', params.max_price)
      if (params.in_stock) query.set('in_stock', params.in_stock)
      if (params.sort) query.set('sort', params.sort)
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

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    api.get('/categories/').then(({ data }) => {
      const list = data.results ?? data
      setCategories(Array.isArray(list) ? list : [])
    }).catch(() => {})
  }, [])

  // Keep the page's search input in sync when the URL search param changes externally (e.g. navbar search)
  useEffect(() => {
    setSearchInput(searchParams.get('search') || '')
  }, [searchParams.get('search')])

  // Close suggestions when clicking outside
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

    if (value.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/products/search/suggestions/?q=${encodeURIComponent(value)}`)
        setSuggestions(data)
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
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

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md" ref={suggestionsRef}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search products..."
              value={searchInput}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-9 pr-9"
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

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onMouseDown={() => applySuggestion(s)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left gap-4"
                >
                  <span className="truncate">{s.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    ৳{parseFloat(s.price).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort + mobile filter */}
        <div className="flex items-center gap-2">
          <Select value={params.sort} onValueChange={(v) => setParam('sort', v)}>
            <SelectTrigger className="w-full sm:w-44">
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
            <SheetTrigger className="relative lg:hidden flex items-center justify-center size-8 rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 transition-colors">
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
              <div className="mt-4">
                <FilterPanel
                  categories={categories}
                  params={params}
                  onParamChange={setParam}
                  onReset={resetFilters}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar filter */}
        <aside className="hidden lg:block w-56 shrink-0">
          <h2 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wide">Filters</h2>
          <FilterPanel
            categories={categories}
            params={params}
            onParamChange={setParam}
            onReset={resetFilters}
          />
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {/* Result count */}
          {!loading && (
            <p className="text-sm text-muted-foreground mb-4">
              {pagination.count} product{pagination.count !== 1 ? 's' : ''} found
              {params.search && <> for "<span className="font-medium text-foreground">{params.search}</span>"</>}
            </p>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                  <Skeleton className="aspect-square w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-8 w-full mt-2" />
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
