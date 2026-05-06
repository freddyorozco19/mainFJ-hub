import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, BarChart3, ShoppingBag, CreditCard, Store, Tag, AlertCircle } from 'lucide-react'
import { api } from '../api'

interface TabAnalytics {
  count: number
  total_cop: number
  average_cop: number
  max_cop: number
  min_cop: number
  top_categories: [string, number][]
  top_stores: [string, number][]
  top_payments: [string, number][]
  statuses: Record<string, number>
  currencies: Record<string, number>
  error?: string
}

const TABS = [
  { key: 'shops',      label: 'Shops',       hex: '#7C3AED', icon: ShoppingBag },
  { key: 'basket',     label: 'Basket',      hex: '#06B6D4', icon: ShoppingBag },
  { key: 'essentials', label: 'Essentials',  hex: '#FBBF24', icon: CreditCard },
  { key: 'ahorro',     label: 'Ahorro',      hex: '#4ADE80', icon: TrendingUp },
  { key: 'debts',      label: 'Debts',       hex: '#F87171', icon: AlertCircle },
  { key: 'wishlist',   label: 'Wishlist',    hex: '#A78BFA', icon: Tag },
]

function formatCOP(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function FinanceAnalytics() {
  const [analytics, setAnalytics] = useState<Record<string, TabAnalytics>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const res = await api('/finance/analytics')
      const data = await res.json()
      setAnalytics(data)
    } catch (e) {
      console.error('Error cargando analytics:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TABS.map(t => (
          <div key={t.key} className="bg-card border border-border rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-24 mb-4" />
            <div className="h-8 bg-slate-700 rounded w-32 mb-3" />
            <div className="h-3 bg-slate-700 rounded w-full mb-2" />
            <div className="h-3 bg-slate-700 rounded w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {TABS.map(({ key, label, hex, icon: Icon }) => {
        const data = analytics[key]
        if (!data || data.error) return null

        return (
          <div
            key={key}
            className="bg-card border border-border rounded-xl p-5 hover:border-white/10 transition-colors"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: hex + '20', border: `1px solid ${hex}40` }}
                >
                  <Icon size={15} style={{ color: hex }} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{label}</h4>
                  <p className="text-[10px] text-slate-500">{data.count} registros</p>
                </div>
              </div>
              <p className="text-lg font-bold" style={{ color: hex }}>
                {formatCOP(data.total_cop)}
              </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-surface/50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500 mb-0.5">Promedio</p>
                <p className="text-xs font-semibold text-slate-300">{formatCOP(data.average_cop)}</p>
              </div>
              <div className="bg-surface/50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500 mb-0.5">Máx</p>
                <p className="text-xs font-semibold text-emerald-400">{formatCOP(data.max_cop)}</p>
              </div>
              <div className="bg-surface/50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500 mb-0.5">Mín</p>
                <p className="text-xs font-semibold text-slate-400">{formatCOP(data.min_cop)}</p>
              </div>
            </div>

            {/* Top Categorías */}
            {data.top_categories.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Top Categorías</p>
                <div className="space-y-1">
                  {data.top_categories.slice(0, 3).map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 truncate max-w-[120px]">{cat}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(count / data.count) * 100}%`,
                              backgroundColor: hex,
                              opacity: 0.6,
                            }}
                          />
                        </div>
                        <span className="text-slate-500 text-[10px] w-4 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Tiendas */}
            {data.top_stores.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Top Tiendas</p>
                <div className="flex flex-wrap gap-1">
                  {data.top_stores.slice(0, 3).map(([store, count]) => (
                    <span
                      key={store}
                      className="text-[10px] px-2 py-0.5 rounded-md border"
                      style={{
                        backgroundColor: hex + '10',
                        borderColor: hex + '30',
                        color: hex,
                      }}
                    >
                      {store} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Métodos de pago */}
            {data.top_payments.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Pagos</p>
                <div className="flex flex-wrap gap-1">
                  {data.top_payments.slice(0, 3).map(([pay, count]) => (
                    <span
                      key={pay}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-surface border border-border text-slate-400"
                    >
                      {pay}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Estados (solo debts) */}
            {key === 'debts' && (
              <div>
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Estados</p>
                <div className="flex gap-2">
                  {Object.entries(data.statuses).filter(([,v]) => v > 0).map(([status, count]) => (
                    <span
                      key={status}
                      className={`text-[10px] px-2 py-0.5 rounded-md border ${
                        status === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : status === 'PENDIENTE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}
                    >
                      {status}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Monedas */}
            {Object.keys(data.currencies).length > 1 && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex gap-2">
                  {Object.entries(data.currencies).map(([curr, count]) => (
                    <span key={curr} className="text-[10px] text-slate-500">
                      {curr}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
