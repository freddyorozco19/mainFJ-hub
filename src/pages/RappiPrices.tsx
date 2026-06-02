import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ShoppingCart, TrendingDown, TrendingUp, Minus,
  RefreshCw, Package, Store, ChevronDown, ChevronUp,
  AlertCircle, Calendar, Search, Plus, Zap, ExternalLink,
  MapPin, X, ChevronRight, Home, Pencil, Trash2, Check, ScanLine, BookOpen,
  LayoutGrid, Table2, Tag, History,
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

/** Estima el tamaño/peso del producto a partir del precio y el pum (precio/unidad).
 *  Ej: precio=$339.340, pum="57.52/g" → 339340/57.52 ≈ 5900g → "5.9kg" */
function calcSize(price: number, pum: string | null | undefined): string | null {
  if (!pum) return null
  const m = pum.match(/^([\d.,]+)\/(kg|g|ml|l|lb|oz)$/i)
  if (!m) return null
  const pumVal = parseFloat(m[1].replace(',', '.'))
  const unit   = m[2].toLowerCase()
  if (!pumVal || pumVal <= 0) return null
  const qty = price / pumVal
  if (unit === 'g')  return qty >= 950 ? `${(qty / 1000).toFixed(1)}kg` : `${Math.round(qty)}g`
  if (unit === 'ml') return qty >= 950 ? `${(qty / 1000).toFixed(1)}L`  : `${Math.round(qty)}ml`
  if (unit === 'kg') return `${qty.toFixed(2)}kg`
  if (unit === 'l')  return `${qty.toFixed(2)}L`
  return `${qty.toFixed(1)}${unit}`
}

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
  presentation: string | null
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

// ─── Tipo entrada de historial de scan ────────────────────────────────────────

interface ScanEntry {
  date: string              // ISO timestamp del momento del scan
  scannedProducts: number   // cantidad de productos encontrados
  scannedStores: number     // cantidad de tiendas únicas
  minPrice: number | null
  minPriceStore: string | null   // tienda con el precio mínimo
  minPriceStoreCount: number     // cuántas tiendas tienen ese precio mínimo
  maxPrice: number | null
  maxPriceStore: string | null   // tienda con el precio máximo
  maxPriceStoreCount: number     // cuántas tiendas tienen ese precio máximo
  promoDetected: boolean    // al menos un producto tenía hasDiscount
}

// ─── Config de ubicaciones ────────────────────────────────────────────────────

const LOCATIONS = [
  {
    id: 'home',
    label: 'HOME',
    address: 'Calle 94A #61-57',
    city: 'Bogotá',
    barrio: 'Barrios Unidos',
    lat: 4.6850868,
    lng: -74.0703650,
  },
]

// ─── Popup de ubicación ───────────────────────────────────────────────────────

function LocationPopup({ lastUpdated, onClose }: { lastUpdated: string | null; onClose: () => void }) {
  const loc = LOCATIONS[0]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popup */}
      <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-slate-900 border border-slate-700/70 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Home size={13} className="text-emerald-400" />
            <span className="text-sm font-semibold text-white">Ubicación activa</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Detalle */}
        <div className="px-4 py-3 space-y-2.5">
          {[
            { label: 'Dirección', value: loc.address },
            { label: 'Ciudad',    value: loc.city    },
            { label: 'Barrio',    value: loc.barrio  },
            { label: 'Últ. act.',
              value: lastUpdated
                ? new Date(lastUpdated).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                : '—'
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-xs text-slate-200 font-medium">{value}</span>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div className="border-t border-slate-700/60 px-3 py-2 space-y-1">
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-white/5 transition-colors">
            <span>Cambiar ubicación</span>
            <ChevronRight size={12} className="text-slate-500" />
          </button>
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-white/5 transition-colors">
            <span className="flex items-center gap-1.5"><Plus size={11} />Agregar ubicación</span>
            <ChevronRight size={12} className="text-slate-500" />
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Panel de búsqueda en vivo ────────────────────────────────────────────────

type SearchSource = 'rappi' | 'ml'

const SOURCE_CONFIG: Record<SearchSource, { label: string; color: string; activeClass: string; endpoint: string }> = {
  rappi: {
    label:       'Rappi',
    color:       'text-orange-400',
    activeClass: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
    endpoint:    '/rappi/search',
  },
  ml: {
    label:       'Mercado Libre',
    color:       'text-yellow-400',
    activeClass: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
    endpoint:    '/mercadolibre/search',
  },
}

function LiveSearch({
  regProducts,
  onScanSave,
}: {
  regProducts: RegisteredProduct[]
  onScanSave: (productId: string, entry: ScanEntry) => void
}) {
  const [source, setSource]           = useState<SearchSource>('rappi')
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<LiveSearchResponse | null>(null)
  const [searching, setSearching]     = useState(false)
  const [liveError, setLiveError]     = useState<string | null>(null)
  const [selectedRegId, setSelectedRegId]         = useState('')
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [saveDone, setSaveDone]       = useState(false)
  const [progress, setProgress]       = useState<{ current: number; total: number; name: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const endpoint = SOURCE_CONFIG[source].endpoint

  // ── Cambio de fuente → re-lanza búsqueda actual ──
  const handleSourceChange = (s: SearchSource) => {
    setSource(s)
    setResults(null)
    setSaveDone(false)
    if (selectedInventoryId) {
      const prod  = regProducts.find(p => p.id === selectedInventoryId)
      const names = prod?.searchNames?.length ? prod.searchNames : prod ? [prod.name] : []
      if (names.length) setTimeout(() => runMultiSearchWith(names, selectedInventoryId, SOURCE_CONFIG[s].endpoint), 0)
    } else if (query.trim().length >= 2) {
      setTimeout(() => handleSearchWith(query, SOURCE_CONFIG[s].endpoint), 0)
    }
  }

  // ── Búsqueda libre (texto) ──
  const handleSearchWith = async (q: string, ep: string) => {
    if (q.trim().length < 2) { setResults(null); return }
    setSearching(true); setLiveError(null); setProgress(null)
    try {
      const res = await fetch(`${API_BASE}${ep}?query=${encodeURIComponent(q)}&limit=30`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setResults(await res.json())
    } catch (e: any) {
      setLiveError(e.message || 'Error al buscar')
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  const handleSearch = (q: string) => handleSearchWith(q, endpoint)

  // ── Multi-búsqueda por searchNames del producto del inventario ──
  const runMultiSearchWith = async (searchNames: string[], productId: string, ep: string) => {
    if (searchNames.length === 0) return
    setSearching(true); setLiveError(null); setResults(null); setProgress(null)
    setSaveDone(false)

    const allProducts: LiveResult[] = []
    const allStores   = new Set<string>()
    const seen        = new Set<string>()

    for (let i = 0; i < searchNames.length; i++) {
      const name = searchNames[i].trim()
      if (!name) continue
      setProgress({ current: i + 1, total: searchNames.length, name })
      try {
        const res = await fetch(`${API_BASE}${ep}?query=${encodeURIComponent(name)}&limit=30`)
        if (!res.ok) continue
        const data: LiveSearchResponse = await res.json()
        for (const p of data.products) {
          const key = `${p.name}_${p.store}`
          if (!seen.has(key)) {
            seen.add(key)
            allProducts.push(p)
            if (p.store) allStores.add(p.store)
          }
        }
      } catch { /* continuar con el siguiente nombre */ }
    }

    allProducts.sort((a, b) => a.price - b.price)
    const merged: LiveSearchResponse = {
      query:    searchNames.join(', '),
      count:    allProducts.length,
      total:    allProducts.length,
      products: allProducts,
      stores:   [...allStores],
      minPrice: allProducts[0]?.price ?? null,
      maxPrice: allProducts[allProducts.length - 1]?.price ?? null,
    }

    setResults(merged)
    setSearching(false)
    setProgress(null)
    // Pre-vincular el Confirmar al producto seleccionado
    setSelectedRegId(productId)
  }

  const runMultiSearch = (searchNames: string[], productId: string) =>
    runMultiSearchWith(searchNames, productId, endpoint)

  const onInventorySelect = (id: string) => {
    setSelectedInventoryId(id)
    setQuery('')
    setSaveDone(false)
    setSelectedRegId('')
    if (!id) { setResults(null); return }
    const prod = regProducts.find(p => p.id === id)
    if (!prod) return
    const names = prod.searchNames?.length ? prod.searchNames : [prod.name]
    runMultiSearchWith(names, id, endpoint)
  }

  const onInput = (val: string) => {
    setQuery(val)
    setSelectedInventoryId('')
    setSaveDone(false)
    setSelectedRegId('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(val), 600)
  }

  const saveToRegister = () => {
    if (!results || !selectedRegId) return
    const prods = results.products

    const minPrice = results.minPrice
    const maxPrice = results.maxPrice

    const minItems = prods.filter(p => p.price === minPrice)
    const maxItems = prods.filter(p => p.price === maxPrice)

    const minStores = [...new Set(minItems.map(p => p.store).filter(Boolean))]
    const maxStores = [...new Set(maxItems.map(p => p.store).filter(Boolean))]

    const entry: ScanEntry = {
      date:                new Date().toISOString(),
      scannedProducts:     results.count,
      scannedStores:       results.stores.length,
      minPrice,
      minPriceStore:       minStores[0] ?? null,
      minPriceStoreCount:  minStores.length,
      maxPrice,
      maxPriceStore:       maxStores[0] ?? null,
      maxPriceStoreCount:  maxStores.length,
      promoDetected:       prods.some(p => p.hasDiscount),
    }
    onScanSave(selectedRegId, entry)
    setSaveDone(true)
    setTimeout(() => setSaveDone(false), 3000)
  }

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-orange-400" />
          <span className="text-sm font-medium text-white">Búsqueda en vivo</span>
        </div>
        {/* ── Tabs de fuente ── */}
        <div className="flex gap-1 p-0.5 bg-slate-800 border border-slate-700/60 rounded-lg">
          {(Object.keys(SOURCE_CONFIG) as SearchSource[]).map(s => (
            <button
              key={s}
              onClick={() => handleSourceChange(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                source === s
                  ? SOURCE_CONFIG[s].activeClass
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {SOURCE_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Selector de inventario ── */}
      {regProducts.length > 0 && (
        <div className="mb-3">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">
            Desde inventario de Registers
          </label>
          <div className="relative">
            <Package size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
            <select
              value={selectedInventoryId}
              onChange={e => onInventorySelect(e.target.value)}
              className="w-full bg-slate-800 border border-orange-500/40 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/70 appearance-none"
            >
              <option value="">— seleccionar producto del inventario —</option>
              {regProducts.map(rp => (
                <option key={rp.id} value={rp.id}>
                  {rp.name}{rp.brand ? ` · ${rp.brand}` : ''}{rp.size ? ` ${rp.size}` : ''}
                  {rp.searchNames?.length ? ` (${rp.searchNames.length} nombres)` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          {selectedInventoryId && (() => {
            const prod = regProducts.find(p => p.id === selectedInventoryId)
            const names = prod?.searchNames ?? []
            return names.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {names.map(n => (
                  <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/40 text-sky-400 border border-sky-700/40">
                    {n}
                  </span>
                ))}
              </div>
            ) : null
          })()}
        </div>
      )}

      {/* ── Divisor o búsqueda libre ── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-slate-700/60" />
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">o búsqueda libre</span>
        <div className="flex-1 h-px bg-slate-700/60" />
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={e => onInput(e.target.value)}
          disabled={!!selectedInventoryId}
          placeholder={selectedInventoryId ? 'Búsqueda libre desactivada — producto seleccionado arriba' : 'Ej: purina one gatos, leche entera alpina...'}
          className="w-full bg-slate-800 border border-slate-700/60 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60 disabled:opacity-40 disabled:cursor-not-allowed"
        />
        {searching && !progress && (
          <RefreshCw size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 animate-spin" />
        )}
      </div>

      {/* ── Progreso multi-búsqueda ── */}
      {progress && (
        <div className="mt-2 flex items-center gap-2">
          <RefreshCw size={11} className="text-orange-400 animate-spin flex-shrink-0" />
          <span className="text-xs text-slate-400 flex-1 truncate">
            Buscando <span className="text-sky-400">"{progress.name}"</span>
            <span className="text-slate-500"> — variante {progress.current} de {progress.total}</span>
          </span>
          <div className="flex gap-0.5">
            {Array.from({ length: progress.total }).map((_, i) => (
              <div key={i} className={`h-1 w-4 rounded-full ${i < progress.current ? 'bg-orange-400' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>
      )}

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
                  <div className="text-[10px] text-slate-500">
                    {p.store || '?'}
                    {(p.presentation || calcSize(p.price, p.pum))
                      ? ` · ${p.presentation || calcSize(p.price, p.pum)}`
                      : ''}
                    {p.pum ? ` · ${p.pum}` : ''}
                  </div>
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

          {/* ── Guardar escaneo en Registro ── */}
          <div className="mt-3 pt-3 border-t border-slate-700/60">
            {selectedInventoryId ? (
              /* Producto ya pre-vinculado desde el inventario */
              <div className="flex items-center gap-2">
                <History size={13} className="text-slate-500 flex-shrink-0" />
                <span className="text-xs text-slate-400 flex-1 truncate">
                  Guardar scan en <span className="text-white font-medium">
                    {regProducts.find(p => p.id === selectedInventoryId)?.name}
                  </span>
                </span>
                {saveDone ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Check size={12} /> Guardado
                  </span>
                ) : (
                  <button
                    onClick={saveToRegister}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg border border-orange-500/40 transition-colors font-medium"
                  >
                    <Check size={12} /> Confirmar
                  </button>
                )}
              </div>
            ) : regProducts.length > 0 ? (
              /* Búsqueda libre → selector manual */
              <div className="flex items-center gap-2">
                <History size={13} className="text-slate-500 flex-shrink-0" />
                <span className="text-xs text-slate-500 flex-shrink-0">Guardar en Registro:</span>
                <select
                  value={selectedRegId}
                  onChange={e => { setSelectedRegId(e.target.value); setSaveDone(false) }}
                  className="flex-1 bg-slate-800 border border-slate-700/60 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500/60 min-w-0"
                >
                  <option value="">— seleccionar producto —</option>
                  {regProducts.map(rp => (
                    <option key={rp.id} value={rp.id}>
                      {rp.name}{rp.brand ? ` · ${rp.brand}` : ''}{rp.size ? ` ${rp.size}` : ''}
                    </option>
                  ))}
                </select>
                {saveDone ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 flex-shrink-0">
                    <Check size={12} /> Guardado
                  </span>
                ) : (
                  <button
                    onClick={saveToRegister}
                    disabled={!selectedRegId}
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 rounded-lg border border-orange-500/30 transition-colors disabled:opacity-40"
                  >
                    <Plus size={11} /> Confirmar
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tipo producto rastreado ──────────────────────────────────────────────────

interface RegisteredProduct {
  id: string
  name: string
  brand?: string
  size?: string
  searchNames: string[]   // distintos nombres del producto (para buscar variantes)
  keywords: string[]      // términos Rappi específicos
  scanHistory?: ScanEntry[]
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiGetRegisters(): Promise<RegisteredProduct[]> {
  const r = await fetch(`${API_BASE}/rappi/registers`)
  if (!r.ok) throw new Error('Error cargando registros')
  return r.json()
}
async function apiCreateRegister(p: RegisteredProduct): Promise<void> {
  await fetch(`${API_BASE}/rappi/registers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
  })
}
async function apiUpdateRegister(p: RegisteredProduct): Promise<void> {
  await fetch(`${API_BASE}/rappi/registers/${p.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
  })
}
async function apiDeleteRegister(id: string): Promise<void> {
  await fetch(`${API_BASE}/rappi/registers/${id}`, { method: 'DELETE' })
}
async function apiAddScan(productId: string, entry: ScanEntry): Promise<void> {
  await fetch(`${API_BASE}/rappi/registers/${productId}/scans`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
  })
}

// ─── Componente Registers ─────────────────────────────────────────────────────

function Registers({
  products,
  onAdd,
  onEdit,
  onDelete,
}: {
  products: RegisteredProduct[]
  onAdd:    (p: RegisteredProduct) => void
  onEdit:   (p: RegisteredProduct) => void
  onDelete: (id: string) => void
}) {
  const [editingId, setEditingId]             = useState<string | null>(null)
  const [editName, setEditName]               = useState('')
  const [editBrand, setEditBrand]             = useState('')
  const [editSize, setEditSize]               = useState('')
  const [editSearchNames, setEditSearchNames] = useState('')
  const [editKeywords, setEditKeywords]       = useState('')
  const [adding, setAdding]                   = useState(false)
  const [newName, setNewName]                 = useState('')
  const [newBrand, setNewBrand]               = useState('')
  const [newSize, setNewSize]                 = useState('')
  const [newSearchNames, setNewSearchNames]   = useState('')
  const [newKeywords, setNewKeywords]         = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [view, setView]                   = useState<'cards' | 'table'>('cards')
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null)

  const splitComma = (s: string) => s.split(',').map(v => v.trim()).filter(Boolean)

  const startEdit = (p: RegisteredProduct) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditBrand(p.brand ?? '')
    setEditSize(p.size ?? '')
    setEditSearchNames((p.searchNames ?? []).join(', '))
    setEditKeywords(p.keywords.join(', '))
    setDeleteConfirm(null)
  }

  const saveEdit = () => {
    if (!editName.trim()) return
    const updated = products.find(p => p.id === editingId)
    if (!updated) return
    const edited: RegisteredProduct = {
      ...updated,
      name: editName.trim(), brand: editBrand.trim(), size: editSize.trim(),
      searchNames: splitComma(editSearchNames), keywords: splitComma(editKeywords),
    }
    onEdit(edited)
    setEditingId(null)
  }

  const deleteProduct = (id: string) => {
    onDelete(id)
    setDeleteConfirm(null)
  }

  const addProduct = () => {
    if (!newName.trim()) return
    const id = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const searchNames = splitComma(newSearchNames)
    if (searchNames.length === 0) searchNames.push(newName.trim().toLowerCase())
    const keywords = splitComma(newKeywords)
    if (keywords.length === 0) keywords.push(newName.trim().toLowerCase())
    onAdd({ id: `${id}-${Date.now()}`, name: newName.trim(), brand: newBrand.trim(), size: newSize.trim(), searchNames, keywords })
    setNewName(''); setNewBrand(''); setNewSize(''); setNewSearchNames(''); setNewKeywords(''); setAdding(false)
  }

  return (
    <div className="space-y-3">

      {/* Toggle Cards / Table */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{products.length} producto{products.length !== 1 ? 's' : ''} registrado{products.length !== 1 ? 's' : ''}</span>
        <div className="flex gap-0.5 p-0.5 bg-slate-800 border border-slate-700/60 rounded-lg">
          {([
            { key: 'cards', icon: LayoutGrid },
            { key: 'table', icon: Table2    },
          ] as const).map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`p-1.5 rounded-md transition-colors ${
                view === key ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Vista TABLE ── */}
      {view === 'table' && (
        <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/60 text-left">
                <th className="px-4 py-2.5 text-slate-500 font-medium w-8">#</th>
                <th className="px-4 py-2.5 text-slate-500 font-medium">Nombre</th>
                <th className="px-4 py-2.5 text-slate-500 font-medium">Marca</th>
                <th className="px-4 py-2.5 text-slate-500 font-medium">Tamaño</th>
                <th className="px-4 py-2.5 text-slate-500 font-medium">Search Name</th>
                <th className="px-4 py-2.5 text-slate-500 font-medium">Keywords</th>
                <th className="px-4 py-2.5 text-slate-500 font-medium text-center">Scans</th>
                <th className="px-4 py-2.5 text-slate-500 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} className="border-b border-slate-700/30 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-slate-600">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-slate-400">{p.brand || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-slate-400">{p.size || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.searchNames ?? []).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-sky-900/40 text-sky-400 border border-sky-700/40 whitespace-nowrap">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.keywords.map(k => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50 whitespace-nowrap">
                          {k}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      (p.scanHistory?.length ?? 0) > 0
                        ? 'bg-sky-900/40 text-sky-400 border border-sky-700/40'
                        : 'text-slate-600'
                    }`}>
                      {p.scanHistory?.length ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => { setView('cards'); startEdit(p) }}
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      {deleteConfirm === p.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteProduct(p.id)} className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded border border-red-500/30 hover:bg-red-500/30">Sí</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(p.id)}
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Vista CARDS ── */}
      {view === 'cards' && <>{products.map(p => (
        <div key={p.id} className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
          {editingId === p.id ? (
            /* ── Modo edición ── */
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Nombre</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/60"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Marca</label>
                  <input
                    value={editBrand}
                    onChange={e => setEditBrand(e.target.value)}
                    placeholder="Ej: Alquería"
                    className="w-full bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Tamaño</label>
                  <input
                    value={editSize}
                    onChange={e => setEditSize(e.target.value)}
                    placeholder="Ej: 1L, 500g, x12"
                    className="w-full bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">
                  Search Name <span className="normal-case">(nombres del producto separados por coma)</span>
                </label>
                <input
                  value={editSearchNames}
                  onChange={e => setEditSearchNames(e.target.value)}
                  placeholder="ej: leche entera, leche larga vida, leche UHT"
                  className="w-full bg-slate-800 border border-sky-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/60"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">
                  Keywords Rappi <span className="normal-case">(términos de búsqueda en Rappi, separados por coma)</span>
                </label>
                <input
                  value={editKeywords}
                  onChange={e => setEditKeywords(e.target.value)}
                  placeholder="ej: purina one esterilizados, purina gato carne"
                  className="w-full bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                  Cancelar
                </button>
                <button onClick={saveEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg border border-emerald-500/30 transition-colors">
                  <Check size={12} /> Guardar
                </button>
              </div>
            </div>
          ) : (
            /* ── Vista normal ── */
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Package size={14} className="text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{p.name}</span>
                  {p.brand && <span className="text-[11px] text-orange-400/80 font-medium shrink-0">{p.brand}</span>}
                  {p.size  && <span className="text-[11px] text-slate-400 shrink-0">{p.size}</span>}
                </div>
                {p.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.keywords.map(k => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => startEdit(p)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
                >
                  <Pencil size={13} />
                </button>
                {deleteConfirm === p.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-400">¿Eliminar?</span>
                    <button onClick={() => deleteProduct(p.id)} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded border border-red-500/30 hover:bg-red-500/30 transition-colors">Sí</button>
                    <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(p.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Historial de scans ── */}
          {(() => {
            const scans = p.scanHistory ?? []
            const isOpen = expandedScanId === p.id
            return (
              <div className="border-t border-slate-700/40">
                <button
                  onClick={() => setExpandedScanId(isOpen ? null : p.id)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <History size={11} className="text-slate-500 flex-shrink-0" />
                  <span className="text-[10px] text-slate-500 flex-1">
                    Historial de scans
                    {scans.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sky-900/40 text-sky-400 border border-sky-700/40">{scans.length}</span>}
                  </span>
                  {isOpen ? <ChevronUp size={11} className="text-slate-600" /> : <ChevronDown size={11} className="text-slate-600" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-3">
                    {scans.length === 0 ? (
                      <p className="text-[11px] text-slate-600 text-center py-3">Sin scans guardados aún</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-700/40">
                              <th className="py-1.5 pr-3 text-left font-medium whitespace-nowrap">Fecha de Scan</th>
                              <th className="py-1.5 pr-3 text-right font-medium">Prods</th>
                              <th className="py-1.5 pr-3 text-right font-medium">Tiendas</th>
                              <th className="py-1.5 pr-3 text-right font-medium whitespace-nowrap">Min Valor</th>
                              <th className="py-1.5 pr-3 text-left font-medium whitespace-nowrap">Tienda Min</th>
                              <th className="py-1.5 pr-3 text-right font-medium whitespace-nowrap"># Min</th>
                              <th className="py-1.5 pr-3 text-right font-medium whitespace-nowrap">Max Valor</th>
                              <th className="py-1.5 pr-3 text-left font-medium whitespace-nowrap">Tienda Max</th>
                              <th className="py-1.5 pr-3 text-right font-medium whitespace-nowrap"># Max</th>
                              <th className="py-1.5 text-center font-medium">Promo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...scans].reverse().map((s, i) => (
                              <tr key={i} className="border-b border-slate-700/20 last:border-0 hover:bg-white/[0.02]">
                                <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                                  {new Date(s.date).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                <td className="py-1.5 pr-3 text-right text-slate-300">{s.scannedProducts}</td>
                                <td className="py-1.5 pr-3 text-right text-slate-300">{s.scannedStores}</td>
                                <td className="py-1.5 pr-3 text-right text-emerald-400 font-medium whitespace-nowrap">{formatCOP(s.minPrice)}</td>
                                <td className="py-1.5 pr-3 text-left text-slate-300 max-w-[100px] truncate">{s.minPriceStore ?? '—'}</td>
                                <td className="py-1.5 pr-3 text-right text-slate-400">{s.minPriceStoreCount ?? '—'}</td>
                                <td className="py-1.5 pr-3 text-right text-slate-300 whitespace-nowrap">{formatCOP(s.maxPrice)}</td>
                                <td className="py-1.5 pr-3 text-left text-slate-300 max-w-[100px] truncate">{s.maxPriceStore ?? '—'}</td>
                                <td className="py-1.5 pr-3 text-right text-slate-400">{s.maxPriceStoreCount ?? '—'}</td>
                                <td className="py-1.5 text-center">
                                  {s.promoDetected
                                    ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30"><Tag size={8} />Sí</span>
                                    : <span className="text-slate-600">—</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      ))}</>}

      {/* Formulario agregar */}
      {adding ? (
        <div className="bg-slate-900 border border-orange-500/30 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-orange-400">Nuevo producto</p>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Nombre</label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ej: Aceite Girasol"
              className="w-full bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Marca</label>
              <input
                value={newBrand}
                onChange={e => setNewBrand(e.target.value)}
                placeholder="Ej: Nutrioli"
                className="w-full bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Tamaño</label>
              <input
                value={newSize}
                onChange={e => setNewSize(e.target.value)}
                placeholder="Ej: 1L, 500g, x12"
                className="w-full bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">
              Search Name <span className="normal-case">(nombres del producto separados por coma)</span>
            </label>
            <input
              value={newSearchNames}
              onChange={e => setNewSearchNames(e.target.value)}
              placeholder="Ej: aceite girasol, aceite vegetal, aceite de girasol"
              className="w-full bg-slate-800 border border-sky-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/60"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">
              Keywords Rappi <span className="normal-case">(términos de búsqueda en Rappi, separados por coma)</span>
            </label>
            <input
              value={newKeywords}
              onChange={e => setNewKeywords(e.target.value)}
              placeholder="Ej: aceite girasol 1L"
              className="w-full bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewName(''); setNewBrand(''); setNewSize(''); setNewSearchNames(''); setNewKeywords('') }} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Cancelar
            </button>
            <button onClick={addProduct} disabled={!newName.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 rounded-lg border border-orange-500/30 transition-colors disabled:opacity-40">
              <Plus size={12} /> Agregar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-slate-400 hover:text-orange-400 border border-dashed border-slate-700/60 hover:border-orange-500/40 rounded-xl transition-colors"
        >
          <Plus size={14} />
          Agregar producto
        </button>
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
  const [showLocationPopup, setShowLocationPopup] = useState(false)
  const [tab, setTab] = useState<'scan' | 'registers'>('scan')

  // Estado compartido de productos registrados
  const [regProducts, setRegProducts]     = useState<RegisteredProduct[]>([])
  const [_regLoading, setRegLoading]       = useState(true)

  // ── Fuente de verdad: Supabase ────────────────────────────────────────────
  /** Recarga la lista desde Supabase y actualiza el estado */
  const reloadRegisters = async () => {
    try {
      const data = await apiGetRegisters()
      setRegProducts(data)
    } catch (e) {
      console.error('[Registers] Error recargando desde Supabase:', e)
    }
  }

  // Carga inicial: Supabase primero; migra localStorage si la tabla está vacía
  useEffect(() => {
    const localData: RegisteredProduct[] = (() => {
      try {
        const s = localStorage.getItem('rappi_registers')
        return s ? JSON.parse(s) : []
      } catch { return [] }
    })()

    apiGetRegisters()
      .then(async (apiData) => {
        // Migrar items de localStorage que no existan en Supabase (por ID)
        if (localData.length > 0) {
          const apiIds = new Set(apiData.map(p => p.id))
          const missing = localData.filter(p => !apiIds.has(p.id))
          if (missing.length > 0) {
            for (const p of missing) {
              try { await apiCreateRegister(p) } catch {}
            }
            return reloadRegisters()
          }
        }
        setRegProducts(apiData)
      })
      .catch(() => {
        // Backend no disponible: mostrar datos locales como fallback temporal
        setRegProducts(localData)
      })
      .finally(() => setRegLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Operaciones CRUD — Supabase primero, luego recarga estado desde la BD
  const handleAdd = async (p: RegisteredProduct) => {
    try {
      await apiCreateRegister(p)
      await reloadRegisters()
    } catch (e) { console.error('[Registers] Error al agregar:', e) }
  }
  const handleEdit = async (p: RegisteredProduct) => {
    try {
      await apiUpdateRegister(p)
      await reloadRegisters()
    } catch (e) { console.error('[Registers] Error al editar:', e) }
  }
  const handleDeleteRegister = async (id: string) => {
    try {
      await apiDeleteRegister(id)
      await reloadRegisters()
    } catch (e) { console.error('[Registers] Error al eliminar:', e) }
  }
  const handleScanSave = async (productId: string, entry: ScanEntry) => {
    try {
      await apiAddScan(productId, entry)
      await reloadRegisters()
    } catch (e) { console.error('[Registers] Error al guardar scan:', e) }
  }

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
            <h1 className="text-xl font-bold text-white">Market Scan</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Historial de precios mínimos por producto en Colombia
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Pill HOME con popup */}
          <div className="relative">
            <button
              onClick={() => setShowLocationPopup(p => !p)}
              className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 px-3 py-1.5 rounded-full border border-emerald-500/25 transition-colors"
            >
              <MapPin size={11} />
              HOME
            </button>
            {showLocationPopup && (
              <LocationPopup
                lastUpdated={data?.lastUpdated ?? null}
                onClose={() => setShowLocationPopup(false)}
              />
            )}
          </div>

          {data?.lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/50">
              <RefreshCw size={11} />
              Actualizado {relativeDays(data.lastUpdated.split('T')[0])}
            </div>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-700/60 rounded-xl mb-6 w-fit">
        {([
          { key: 'scan',      label: 'Scan',      icon: ScanLine  },
          { key: 'registers', label: 'Registers',  icon: BookOpen  },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === key
                ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: REGISTERS ── */}
      {tab === 'registers' && (
        <Registers
          products={regProducts}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteRegister}
        />
      )}

      {/* ── Tab: SCAN ── */}
      {tab === 'scan' && <>

      {/* Búsqueda en vivo contra el backend */}
      <LiveSearch regProducts={regProducts} onScanSave={handleScanSave} />

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

      {/* Barra de búsqueda historial */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar historial de productos..."
          className="w-full bg-slate-900 border border-slate-700/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/60"
        />
      </div>

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

      </> /* fin tab SCAN */}
    </div>
  )
}
