import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ShoppingCart, TrendingDown, TrendingUp, Minus,
  RefreshCw, Package, Store, ChevronDown, ChevronUp,
  AlertCircle, Calendar, Search, Plus, Zap, ExternalLink,
} from 'lucide-react'
import { API_BASE } from '../api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProductResult {
  id: string | null
  name: string
  price: number
  originalPrice: number
  discount: number | null
  store: string | null
  storeId: string | null
  image: string | null
  unit: string | null
}

interface HistoryEntry {
  date: string
  minPrice: number | null
  maxPrice: number | null
  count: number
  results: ProductResult[]
  error: string | null
}

interface TrackedProduct {
  name: string
  history: HistoryEntry[]
}

interface RappiData {
  products: Record<string, TrackedProduct>
  lastUpdated: string | null
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function formatCOP(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${n.toLocaleString('es-CO')}`
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function relativeDays(dateStr: string) {
  const today = new Date()
  const date = new Date(dateStr)
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000)
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'ayer'
  return `hace ${diff} días`
}

function priceTrend(history: HistoryEntry[]): 'up' | 'down' | 'same' | 'unknown' {
  const valid = history.filter(h => h.minPrice != null).slice(-7)
  if (valid.length < 2) return 'unknown'
  const last = valid[valid.length - 1].minPrice!
  const prev = valid[valid.length - 2].minPrice!
  if (last < prev) return 'down'
  if (last > prev) return 'up'
  return 'same'
}

function lowestEver(history: HistoryEntry[]): number | null {
  const prices = history.map(h => h.minPrice).filter((p): p is number => p != null)
  return prices.length > 0 ? Math.min(...prices) : null
}

// ─── Componente MiniSparkline ─────────────────────────────────────────────────

function Sparkline({ history }: { history: HistoryEntry[] }) {
  const data = history.filter(h => h.minPrice != null).slice(-14)
  if (data.length < 2) return <span className="text-slate-600 text-xs">Sin datos</span>

  const prices = data.map(h => h.minPrice!)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const W = 80, H = 28

  const points = data.map((h, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((h.minPrice! - min) / range) * H
    return `${x},${y}`
  }).join(' ')

  const trend = priceTrend(history)
  const color = trend === 'down' ? '#10b981' : trend === 'up' ? '#ef4444' : '#64748b'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Componente ProductCard ───────────────────────────────────────────────────

function ProductCard({ product }: { productId: string; product: TrackedProduct }) {
  const [open, setOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'stores' | 'history'>('stores')

  const latest = product.history[product.history.length - 1]
  const trend = priceTrend(product.history)
  const lowest = lowestEver(product.history)
  const isLowestNow = latest?.minPrice != null && lowest != null && latest.minPrice <= lowest
  const latestStores = latest?.results ?? []

  const TrendIcon = trend === 'down' ? TrendingDown : trend === 'up' ? TrendingUp : Minus
  const trendColor = trend === 'down' ? 'text-emerald-400' : trend === 'up' ? 'text-red-400' : 'text-slate-400'

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Package size={16} className="text-orange-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm truncate">{product.name}</span>
            {isLowestNow && (
              <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                mín. histórico
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-emerald-400 font-semibold text-sm">{formatCOP(latest?.minPrice)}</span>
            {latest?.date && (
              <span className="text-slate-500 text-xs">{relativeDays(latest.date)}</span>
            )}
            {latestStores.length > 0 && (
              <span className="text-slate-500 text-xs">{latestStores.length} tiendas</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Sparkline history={product.history} />
          <TrendIcon size={14} className={trendColor} />
          {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-slate-700/60 px-4 py-3">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-slate-800/60 rounded-lg p-2.5 text-center">
              <div className="text-xs text-slate-500 mb-0.5">Precio mínimo hoy</div>
              <div className="text-emerald-400 font-bold">{formatCOP(latest?.minPrice)}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-2.5 text-center">
              <div className="text-xs text-slate-500 mb-0.5">Precio máximo hoy</div>
              <div className="text-slate-300 font-bold">{formatCOP(latest?.maxPrice)}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-2.5 text-center">
              <div className="text-xs text-slate-500 mb-0.5">Mínimo histórico</div>
              <div className="text-amber-400 font-bold">{formatCOP(lowest)}</div>
            </div>
          </div>

          {/* Toggle view */}
          <div className="flex gap-1 mb-3">
            {(['stores', 'history'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  viewMode === mode
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                {mode === 'stores' ? 'Tiendas disponibles' : 'Historial de precios'}
              </button>
            ))}
          </div>

          {/* Stores view */}
          {viewMode === 'stores' && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {latestStores.length === 0 ? (
                <div className="text-slate-500 text-xs text-center py-4">
                  Sin resultados en la última búsqueda
                </div>
              ) : (
                latestStores.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${
                      i === 0 ? 'bg-emerald-950/40 border border-emerald-700/30' : 'bg-slate-800/40'
                    }`}
                  >
                    <Store size={12} className={i === 0 ? 'text-emerald-400' : 'text-slate-500'} />
                    <span className="flex-1 text-xs text-slate-300 truncate">{s.store || 'Tienda desconocida'}</span>
                    {s.originalPrice > s.price && (
                      <span className="text-xs text-slate-500 line-through">{formatCOP(s.originalPrice)}</span>
                    )}
                    <span className={`text-xs font-semibold ${i === 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {formatCOP(s.price)}
                    </span>
                    {i === 0 && <span className="text-[9px] text-emerald-500 font-bold">MÁS BARATO</span>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* History view */}
          {viewMode === 'history' && (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {[...product.history].reverse().map((h, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5">
                  <Calendar size={11} className="text-slate-500 flex-shrink-0" />
                  <span className="text-xs text-slate-400 w-20 flex-shrink-0">{formatDate(h.date)}</span>
                  {h.error ? (
                    <span className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle size={10} /> Error
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-emerald-400 font-medium">{formatCOP(h.minPrice)}</span>
                      <span className="text-xs text-slate-600">—</span>
                      <span className="text-xs text-slate-400">{formatCOP(h.maxPrice)}</span>
                      <span className="text-xs text-slate-600 ml-auto">{h.count} tiendas</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tipos búsqueda en vivo ───────────────────────────────────────────────────

interface LiveResult {
  id: string | null
  name: string
  price: number
  originalPrice: number
  hasDiscount: boolean
  pum: string | null
  unitType: string | null
  inStock: boolean
  store: string | null
  storeType: string | null
  image: string | null
  rappiUrl: string | null
}

interface LiveSearchResponse {
  query: string
  count: number
  total: number
  products: LiveResult[]
  stores: string[]
  minPrice: number | null
  maxPrice: number | null
}

// ─── Panel de búsqueda en vivo ────────────────────────────────────────────────

function LiveSearch() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<LiveSearchResponse | null>(null)
  const [searching, setSearching] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = async (q: string) => {
    if (q.trim().length < 2) { setResults(null); return }
    setSearching(true); setLiveError(null)
    try {
      const res = await fetch(`${API_BASE}/rappi/search?query=${encodeURIComponent(q)}&limit=30`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data: LiveSearchResponse = await res.json()
      setResults(data)
    } catch (e: any) {
      setLiveError(e.message || 'Error al buscar')
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  const onInput = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(val), 600)
  }

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-orange-400" />
        <span className="text-sm font-medium text-white">Búsqueda en vivo</span>
        <span className="text-xs text-slate-500">— consulta precios actuales directamente desde Rappi</span>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={e => onInput(e.target.value)}
          placeholder="Ej: purina one gatos, leche entera alpina..."
          className="w-full bg-slate-800 border border-slate-700/60 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
        />
        {searching && (
          <RefreshCw size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 animate-spin" />
        )}
      </div>

      {liveError && (
        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
          <AlertCircle size={11} /> {liveError}
        </p>
      )}

      {results && !searching && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">
              {results.count} resultados en {results.stores.length} tiendas
            </span>
            {results.minPrice && (
              <span className="text-xs text-emerald-400 font-medium">
                Desde {formatCOP(results.minPrice)}
              </span>
            )}
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {results.products.map((p, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${
                  i === 0 ? 'bg-emerald-950/40 border border-emerald-700/30' : 'bg-slate-800/40'
                }`}
              >
                <Store size={11} className={i === 0 ? 'text-emerald-400 flex-shrink-0' : 'text-slate-500 flex-shrink-0'} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-500">{p.store || '?'} {p.pum ? `· ${p.pum}` : ''}</div>
                </div>
                {p.originalPrice > p.price && (
                  <span className="text-[10px] text-slate-500 line-through">{formatCOP(p.originalPrice)}</span>
                )}
                <span className={`text-xs font-semibold flex-shrink-0 ${i === 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {formatCOP(p.price)}
                </span>
                {p.rappiUrl && (
                  <a
                    href={p.rappiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Ver en Rappi — ${p.store}`}
                    className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded border bg-slate-700/60 border-slate-600/60 text-slate-400 hover:text-orange-400 hover:border-orange-500/50 transition-colors"
                  >
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RappiPrices() {
  const [data, setData] = useState<RappiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/data/rappi_prices.json')
      .then(r => {
        if (!r.ok) throw new Error('Sin datos aún — ejecuta rappi-tracker.cjs primero')
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const products = useMemo(() => {
    if (!data) return []
    return Object.entries(data.products)
      .filter(([, p]) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
  }, [data, search])

  // Stats globales
  const stats = useMemo(() => {
    if (!data) return null
    const allProducts = Object.values(data.products)
    const withData = allProducts.filter(p => p.history.some(h => h.minPrice != null))
    const drops = allProducts.filter(p => priceTrend(p.history) === 'down').length
    const rises = allProducts.filter(p => priceTrend(p.history) === 'up').length
    return { total: allProducts.length, withData: withData.length, drops, rises }
  }, [data])

  // ── UI ──
  return (
    <div className="px-20 py-6 w-full min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={20} className="text-orange-400" />
            <h1 className="text-xl font-bold text-white">Precios Rappi</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Historial de precios mínimos por producto en Colombia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/25">
            <span>📍</span>
            HOME
          </div>
          {data?.lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/50">
              <RefreshCw size={11} />
              Actualizado {relativeDays(data.lastUpdated.split('T')[0])}
            </div>
          )}
        </div>
      </div>

      {/* Búsqueda en vivo contra el backend */}
      <LiveSearch />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Productos', value: stats.total, icon: Package, color: 'text-slate-300' },
            { label: 'Con datos', value: stats.withData, icon: ShoppingCart, color: 'text-blue-400' },
            { label: 'Bajaron', value: stats.drops, icon: TrendingDown, color: 'text-emerald-400' },
            { label: 'Subieron', value: stats.rises, icon: TrendingUp, color: 'text-red-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
              <Icon size={18} className={color} />
              <div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar productos..."
            className="w-full bg-slate-900 border border-slate-700/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/60"
          />
        </div>
        <button
          onClick={() => setAddingProduct(a => !a)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Agregar producto
        </button>
      </div>

      {/* Agregar producto */}
      {addingProduct && (
        <div className="mb-4 p-4 bg-slate-900 border border-slate-700/60 rounded-xl">
          <p className="text-xs text-slate-400 mb-3">
            Edita <code className="text-orange-400 bg-slate-800 px-1 rounded">rappi-products.json</code> en la raíz del proyecto y agrega el producto, luego corre:
          </p>
          <code className="block bg-slate-800 rounded-lg px-3 py-2 text-sm text-emerald-400">
            node rappi-tracker.cjs
          </code>
          <p className="text-xs text-slate-500 mt-2">
            Los resultados se guardarán automáticamente en <code className="text-slate-400">public/data/rappi_prices.json</code>
          </p>
        </div>
      )}

      {/* Instrucción inicial */}
      {error && (
        <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-8 text-center">
          <ShoppingCart size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium mb-2">Sin datos todavía</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <div className="bg-slate-800 rounded-lg p-3 text-left max-w-md mx-auto">
            <p className="text-xs text-slate-400 mb-1">1. Edita los productos en <code className="text-orange-400">rappi-products.json</code></p>
            <p className="text-xs text-slate-400 mb-1">2. Ejecuta en la terminal:</p>
            <code className="block text-sm text-emerald-400 mt-1">node rappi-tracker.cjs</code>
          </div>
        </div>
      )}

      {loading && !error && (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
          Cargando datos...
        </div>
      )}

      {/* Lista de productos */}
      {!loading && !error && (
        <div className="space-y-3">
          {products.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No se encontraron productos
            </div>
          ) : (
            products.map(([id, product]) => (
              <ProductCard key={id} productId={id} product={product} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
