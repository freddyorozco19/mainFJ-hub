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

// ─── Tipo entrada de historial de scan ────────────────────────────────────────

interface ScanEntry {
  date: string              // ISO timestamp del momento del scan
  scannedProducts: number   // cantidad de productos encontrados
  scannedStores: number     // cantidad de tiendas únicas
  minPrice: number | null
  maxPrice: number | null
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

function LiveSearch({
  regProducts,
  onScanSave,
}: {
  regProducts: RegisteredProduct[]
  onScanSave: (productId: string, entry: ScanEntry) => void
}) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<LiveSearchResponse | null>(null)
  const [searching, setSearching] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [selectedRegId, setSelectedRegId] = useState('')
  const [saveDone, setSaveDone]           = useState(false)
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
    setSaveDone(false)
    setSelectedRegId('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(val), 600)
  }

  const saveToRegister = () => {
    if (!results || !selectedRegId) return
    const entry: ScanEntry = {
      date:             new Date().toISOString(),
      scannedProducts:  results.count,
      scannedStores:    results.stores.length,
      minPrice:         results.minPrice,
      maxPrice:         results.maxPrice,
      promoDetected:    results.products.some(p => p.hasDiscount),
    }
    onScanSave(selectedRegId, entry)
    setSaveDone(true)
    setTimeout(() => setSaveDone(false), 3000)
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

          {/* ── Guardar escaneo en Registro ── */}
          {regProducts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center gap-2">
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
          )}
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

const DEFAULT_PRODUCTS: RegisteredProduct[] = [
  { id: 'leche',           name: 'Leche Entera',                         brand: 'Alquería', size: '1L',   searchNames: ['leche entera', 'leche larga vida', 'leche UHT'],               keywords: ['leche entera']            },
  { id: 'arroz',           name: 'Arroz Blanco',                         brand: 'Roa',      size: '500g', searchNames: ['arroz blanco', 'arroz premium'],                               keywords: ['arroz blanco']            },
  { id: 'huevos',          name: 'Huevos',                               brand: '',         size: 'x12',  searchNames: ['huevos x12', 'huevos por 12', 'docena huevos'],               keywords: ['huevos x12']              },
  { id: 'purina-one-gatos',name: 'Purina One Gatos Esterilizados Carne', brand: 'Purina',   size: '85g',  searchNames: ['purina one esterilizados', 'purina gato carne', 'purina one gato'], keywords: ['purina one esterilizados'] },
]

function loadProducts(): RegisteredProduct[] {
  try {
    const s = localStorage.getItem('rappi_registers')
    if (s) return JSON.parse(s)
  } catch {}
  return DEFAULT_PRODUCTS
}
function saveProducts(products: RegisteredProduct[]) {
  localStorage.setItem('rappi_registers', JSON.stringify(products))
}

// ─── Componente Registers ─────────────────────────────────────────────────────

function Registers({
  products,
  persist,
}: {
  products: RegisteredProduct[]
  persist: (updated: RegisteredProduct[]) => void
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
    persist(products.map(p => p.id === editingId
      ? { ...p, name: editName.trim(), brand: editBrand.trim(), size: editSize.trim(), searchNames: splitComma(editSearchNames), keywords: splitComma(editKeywords) }
      : p
    ))
    setEditingId(null)
  }

  const deleteProduct = (id: string) => {
    persist(products.filter(p => p.id !== id))
    setDeleteConfirm(null)
  }

  const addProduct = () => {
    if (!newName.trim()) return
    const id = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const searchNames = splitComma(newSearchNames)
    if (searchNames.length === 0) searchNames.push(newName.trim().toLowerCase())
    const keywords = splitComma(newKeywords)
    if (keywords.length === 0) keywords.push(newName.trim().toLowerCase())
    persist([...products, { id: `${id}-${Date.now()}`, name: newName.trim(), brand: newBrand.trim(), size: newSize.trim(), searchNames, keywords }])
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
                              <th className="py-1.5 pr-3 text-left font-medium">Fecha de Scan</th>
                              <th className="py-1.5 pr-3 text-right font-medium">Productos</th>
                              <th className="py-1.5 pr-3 text-right font-medium">Tiendas</th>
                              <th className="py-1.5 pr-3 text-right font-medium">Min Valor</th>
                              <th className="py-1.5 pr-3 text-right font-medium">Max Valor</th>
                              <th className="py-1.5 text-center font-medium">Promo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...scans].reverse().map((s, i) => (
                              <tr key={i} className="border-b border-slate-700/20 last:border-0 hover:bg-white/[0.02]">
                                <td className="py-1.5 pr-3 text-slate-400">
                                  {new Date(s.date).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                <td className="py-1.5 pr-3 text-right text-slate-300">{s.scannedProducts}</td>
                                <td className="py-1.5 pr-3 text-right text-slate-300">{s.scannedStores}</td>
                                <td className="py-1.5 pr-3 text-right text-emerald-400 font-medium">{formatCOP(s.minPrice)}</td>
                                <td className="py-1.5 pr-3 text-right text-slate-300">{formatCOP(s.maxPrice)}</td>
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
  const [regProducts, setRegProducts] = useState<RegisteredProduct[]>(loadProducts)
  const persistProducts = (updated: RegisteredProduct[]) => {
    setRegProducts(updated)
    saveProducts(updated)
  }
  const handleScanSave = (productId: string, entry: ScanEntry) => {
    persistProducts(regProducts.map(p =>
      p.id === productId
        ? { ...p, scanHistory: [...(p.scanHistory ?? []), entry] }
        : p
    ))
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
            <h1 className="text-xl font-bold text-white">Rappi Scan</h1>
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
      {tab === 'registers' && <Registers products={regProducts} persist={persistProducts} />}

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
