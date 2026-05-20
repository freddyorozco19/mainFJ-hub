import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot, MessageSquare, TrendingUp, DollarSign, PiggyBank, AlertCircle,
  ShoppingCart, Activity, ChevronRight, Wallet, Heart, Layers,
  ArrowUpRight, Zap, Circle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../store/dashboardStore'
import { api } from '../api'
import { SkeletonCard, SkeletonRow } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'

interface FinanceSummary {
  essentials: { count: number; total_cop: number }
  ahorro:     { count: number; total_cop: number }
  basket:     { count: number; total_cop: number }
  shops:      { count: number; total_cop: number }
  wishlist:   { count: number; total_cop: number }
  debts:      { count: number; total_cop: number }
}

function Sparkline({ data, color = '#7C3AED' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const W = 80, H = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H * 0.8) - H * 0.1}`)
  const trend = data[data.length - 1] >= data[0]
  return (
    <svg width={W} height={H} className="flex-shrink-0">
      <defs>
        <linearGradient id={`g-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M${pts.join(' L')} L${W},${H} L0,${H} Z`}
        fill={`url(#g-${color.replace('#','')})`}
      />
      <path
        d={`M${pts.join(' L')}`}
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(data.length - 1) / (data.length - 1) * W}
        cy={H - ((data[data.length-1] - min) / range) * (H * 0.8) - H * 0.1}
        r="2.5"
        fill={color}
      />
    </svg>
  )
}

const LOG_COLORS: Record<string, string> = {
  error:   'bg-danger',
  warn:    'bg-warning',
  success: 'bg-success',
  info:    'bg-primary',
}

const LOG_BADGES: Record<string, string> = {
  error:   'badge badge-danger',
  warn:    'badge badge-warning',
  success: 'badge badge-success',
  info:    'badge badge-primary',
}

export function Home() {
  const { user } = useAuth()
  const { agents, logs, chatHistories, financeRefreshTick } = useDashboard()
  const [summary, setSummary] = useState<Partial<FinanceSummary>>({})
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [recentRecords, setRecentRecords] = useState<Record<string, string | number>[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    loadSummary()
    loadRecentRecords()
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [financeRefreshTick])

  async function loadSummary() {
    setSummaryLoading(true)
    try { const res = await api('/finance/summary'); setSummary(await res.json()) }
    catch { /* ignore */ } finally { setSummaryLoading(false) }
  }

  async function loadRecentRecords() {
    setRecordsLoading(true)
    try {
      const all: Record<string, string | number>[] = []
      for (const tab of ['shops', 'basket', 'essentials']) {
        const res = await api('/finance/data/' + tab)
        const data = await res.json()
        if (data.records) all.push(...data.records.slice(-3).map((r: any) => ({ ...r, _tab: tab })))
      }
      setRecentRecords(all.slice(-6).reverse())
    } catch { /* ignore */ } finally { setRecordsLoading(false) }
  }

  const totalGastos = Object.values(summary).reduce((acc, s) => acc + (s?.total_cop ?? 0), 0)
  const totalRegistros = Object.values(summary).reduce((acc, s) => acc + (s?.count ?? 0), 0)
  const totalConversaciones = Object.values(chatHistories).reduce((acc, msgs) => acc + msgs.length, 0)
  const agentesOnline = agents.filter(a => a.status === 'online').length || 4
  const ultimosLogs = logs.slice(0, 6)
  const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
  const fmtM = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n)

  const greeting = (() => {
    const h = now.getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const statCards = [
    {
      label: 'Gastos Totales',
      value: summaryLoading ? '—' : `$${fmtM(totalGastos)}`,
      sub: `${totalRegistros} registros`,
      icon: Wallet,
      link: '/finance',
      color: '#7C3AED',
      iconBg: 'bg-violet-500/10 border-violet-500/20',
      iconText: 'text-violet-400',
      spark: [2.1,2.4,2.0,2.7,2.5,2.9,totalGastos/1_000_000||3.1],
    },
    {
      label: 'Agentes Online',
      value: String(agentesOnline),
      sub: `de ${agents.length || 8} total`,
      icon: Bot,
      link: '/agents',
      color: '#10B981',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      iconText: 'text-emerald-400',
      spark: [2,3,2,4,3,4,agentesOnline],
    },
    {
      label: 'Conversaciones',
      value: String(totalConversaciones),
      sub: 'mensajes totales',
      icon: MessageSquare,
      link: '/chat',
      color: '#06B6D4',
      iconBg: 'bg-cyan-500/10 border-cyan-500/20',
      iconText: 'text-cyan-400',
      spark: [5,8,6,10,9,12,totalConversaciones||13],
    },
    {
      label: 'Logs de Sistema',
      value: String(logs.length),
      sub: `${logs.filter(l=>l.level==='error').length} errores`,
      icon: Activity,
      link: '/logs',
      color: '#F59E0B',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
      iconText: 'text-amber-400',
      spark: [8,12,9,14,11,16,logs.length||17],
    },
  ]

  const financeBreakdown = [
    { key: 'shops',      label: 'Compras',  icon: ShoppingCart, color: '#7C3AED', amount: summary.shops?.total_cop ?? 0,  count: summary.shops?.count ?? 0  },
    { key: 'basket',     label: 'Canasta',  icon: ShoppingCart, color: '#06B6D4', amount: summary.basket?.total_cop ?? 0, count: summary.basket?.count ?? 0 },
    { key: 'ahorro',     label: 'Ahorro',   icon: PiggyBank,    color: '#10B981', amount: summary.ahorro?.total_cop ?? 0, count: summary.ahorro?.count ?? 0 },
    { key: 'debts',      label: 'Deudas',   icon: AlertCircle,  color: '#EF4444', amount: summary.debts?.total_cop ?? 0,  count: summary.debts?.count ?? 0  },
  ]

  const quickLinks = [
    { name: 'Finanzas',  desc: 'Control financiero', path: '/finance', icon: Wallet,     color: '#10B981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
    { name: 'Health',    desc: 'Salud y bienestar',  path: '/health',  icon: Heart,      color: '#EF4444', bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400'     },
    { name: 'Backlog',   desc: 'Tareas pendientes',  path: '/backlog', icon: Layers,     color: '#8B5CF6', bg: 'bg-violet-500/10', border: 'border-violet-500/20',  text: 'text-violet-400' },
    { name: 'GrowData',  desc: 'Datos de negocio',   path: '/growdata',icon: TrendingUp, color: '#06B6D4', bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',    text: 'text-cyan-400'   },
  ]

  const firstName = user?.name?.split(' ')[0] || 'Freddy'

  return (
    <div className="flex-1 overflow-auto" style={{ background: 'var(--bg)' }}>
      {/* Hero header */}
      <div className="relative px-5 md:px-7 pt-7 pb-5 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 100% at 20% -20%, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />

        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.5)]">
                <Zap size={10} className="text-white" />
              </div>
              <span className="text-xs text-slate-600 font-medium">FJ Hub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {greeting}, <span className="gradient-text">{firstName}</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              {now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping-slow" />
              <span className="text-[10px] text-emerald-400 font-medium">{agentesOnline} activos</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-7 pb-8 space-y-6">

        {/* Stat cards row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryLoading
            ? [0,1,2,3].map(i => <SkeletonCard key={i} />)
            : statCards.map(({ label, value, sub, icon: Icon, link, color, iconBg, iconText, spark }) => (
              <Link
                key={label}
                to={link}
                className="group relative rounded-2xl p-4 border border-white/[0.06] bg-card card-hover overflow-hidden"
              >
                {/* Subtle glow on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                  style={{ background: `radial-gradient(circle at top left, ${color}10 0%, transparent 60%)` }} />

                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-8 h-8 ${iconBg} border rounded-lg flex items-center justify-center`}>
                      <Icon size={14} className={iconText} />
                    </div>
                    <Sparkline data={spark} color={color} />
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-white tracking-tight">{value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-700 group-hover:text-slate-500 transition-colors">
                    {sub} <ArrowUpRight size={9} />
                  </div>
                </div>
              </Link>
            ))
          }
        </div>

        {/* Main bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Finance breakdown */}
          <div className="rounded-2xl border border-white/[0.06] bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Finanzas</h3>
                <p className="text-[11px] text-slate-600 mt-0.5">Resumen por categoría</p>
              </div>
              <Link to="/finance" className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-primary transition-colors">
                Ver todo <ArrowUpRight size={11} />
              </Link>
            </div>

            {summaryLoading
              ? <div className="space-y-3"><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
              : (
                <div className="space-y-2">
                  {financeBreakdown.map(({ label, icon: Icon, color, amount, count }) => {
                    const pct = totalGastos > 0 ? (amount / totalGastos) * 100 : 0
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon size={12} style={{ color }} />
                            <span className="text-xs text-slate-400">{label}</span>
                            <span className="text-[10px] text-slate-700">({count})</span>
                          </div>
                          <span className="text-xs font-mono text-slate-300">{fmt(amount)}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  <div className="pt-3 mt-2 border-t border-white/[0.05] flex items-center justify-between">
                    <span className="text-xs text-slate-500">Total</span>
                    <span className="text-sm font-bold font-mono gradient-text">{fmt(totalGastos)}</span>
                  </div>
                </div>
              )
            }
          </div>

          {/* Recent activity / logs */}
          <div className="rounded-2xl border border-white/[0.06] bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Actividad</h3>
                <p className="text-[11px] text-slate-600 mt-0.5">Eventos en tiempo real</p>
              </div>
              <Link to="/logs" className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-primary transition-colors">
                Ver logs <ArrowUpRight size={11} />
              </Link>
            </div>

            {ultimosLogs.length === 0
              ? <EmptyState icon={Activity} title="Sin actividad reciente" description="Los eventos aparecerán aquí en tiempo real" />
              : (
                <div className="space-y-2">
                  {ultimosLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-2 border-b border-white/[0.04] last:border-0">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${LOG_COLORS[log.level] || 'bg-primary'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 truncate">{log.action}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-700">{log.agentSlug}</span>
                          <span className="text-[10px] text-slate-700">·</span>
                          <span className="text-[10px] text-slate-700">
                            {new Date(log.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <span className={LOG_BADGES[log.level] || 'badge badge-primary'}>{log.level}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* Recent finance records */}
          <div className="rounded-2xl border border-white/[0.06] bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Últimos registros</h3>
                <p className="text-[11px] text-slate-600 mt-0.5">Movimientos recientes</p>
              </div>
              <Link to="/finance" className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-primary transition-colors">
                Ver todo <ArrowUpRight size={11} />
              </Link>
            </div>

            {recordsLoading
              ? <div className="space-y-2"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
              : recentRecords.length === 0
                ? <EmptyState icon={DollarSign} title="Sin registros recientes" />
                : (
                  <div className="space-y-2">
                    {recentRecords.map((rec, i) => {
                      const tabColors: Record<string, string> = {
                        shops:      'badge-primary',
                        basket:     'badge badge-primary',
                        essentials: 'badge badge-warning',
                      }
                      return (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-300 truncate">
                              {String(rec.PRODUCTO || rec.NOMBRE || rec.CONCEPTO || rec.PRODUCT || 'Registro')}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`badge ${tabColors[String(rec._tab)] || 'badge-primary'}`}>{String(rec._tab)}</span>
                              {rec.FECHA || rec.MES || rec.DATE
                                ? <span className="text-[10px] text-slate-700">{String(rec.FECHA || rec.MES || rec.DATE)}</span>
                                : null
                              }
                            </div>
                          </div>
                          <span className="text-xs font-mono text-emerald-400 flex-shrink-0">
                            {fmt(Number(String(rec.VALOR || rec.VALUE || 0).replace(/\D/g, '')) || 0)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
            }
          </div>
        </div>

        {/* Quick access modules */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Acceso rápido</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickLinks.map(({ name, desc, path, icon: Icon, color, bg, border, text }) => (
              <Link
                key={name}
                to={path}
                className="group relative rounded-2xl p-4 border border-white/[0.06] bg-card overflow-hidden card-hover"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `radial-gradient(circle at bottom right, ${color}0D 0%, transparent 60%)` }} />
                <div className="relative">
                  <div className={`w-10 h-10 ${bg} border ${border} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon size={18} className={text} />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">{name}</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">{desc}</p>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight size={14} className="text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}