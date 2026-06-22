import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bot, TrendingUp, PiggyBank, AlertCircle, ShoppingCart, Activity, Wallet, Heart, Layers, ArrowUpRight, Zap, CreditCard, Repeat2, X, ExternalLink, CalendarDays, Tag } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../store/dashboardStore'
import { api, API_BASE, getToken } from '../api'
import { SkeletonCard, SkeletonRow } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { CalendarWidget } from '../components/CalendarWidget'
import { EmailWidget } from '../components/EmailWidget'

type UpcomingItem = {
  nombre: string
  tipo: 'TC' | 'Sus'
  color: string
  date: Date
  days: number
  tcDetails?: { cardType: string; last4: string; dia: number }
  susDetails?: { descripcion: string; precio: number; moneda: string; ciclo: string; tarjeta: string; url: string; estado: string; categoria: string; dia: number }
}

interface FinanceSummary {
  essentials: { count: number; total_cop: number }
  ahorro:     { count: number; total_cop: number }
  basket:     { count: number; total_cop: number }
  shops:      { count: number; total_cop: number }
  wishlist:   { count: number; total_cop: number }
  debts:      { count: number; total_cop: number }
}

function Sparkline({ data, color = '#7C3AED' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const W = 80, H = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H * 0.8) - H * 0.1}`)
  return (
    <svg width={W} height={H} className="flex-shrink-0">
      <defs>
        <linearGradient id={`g-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M${pts.join(' L')} L${W},${H} L0,${H} Z`} fill={`url(#g-${color.replace('#','')})`} />
      <path d={`M${pts.join(' L')}`} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * W} cy={H - ((data[data.length-1] - min) / range) * (H * 0.8) - H * 0.1} r="2.5" fill={color} />
    </svg>
  )
}

const PRIORITY_STYLES: Record<string, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-400',    label: 'Critica' },
  high:     { dot: 'bg-orange-400', label: 'Alta'    },
  medium:   { dot: 'bg-yellow-400', label: 'Media'   },
  low:      { dot: 'bg-slate-500',  label: 'Baja'    },
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  in_progress: { label: 'En progreso', color: 'text-blue-400'   },
  review:      { label: 'Review',      color: 'text-amber-400'  },
  backlog:     { label: 'Backlog',     color: 'text-slate-500'  },
}

export function Home() {
  const { user } = useAuth()
  const { agents, logs, financeRefreshTick } = useDashboard()
  const [summary, setSummary]               = useState<Partial<FinanceSummary>>({})
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [backlogTasks, setBacklogTasks]     = useState<any[]>([])
  const [backlogLoading, setBacklogLoading] = useState(true)
  const [healthData, setHealthData]         = useState<any>(null)
  const [healthLoading, setHealthLoading]   = useState(true)
  const [now, setNow]                       = useState(new Date())
  const [suscripciones, setSuscripciones]   = useState<any[]>([])
  const [selectedUpcoming, setSelectedUpcoming] = useState<UpcomingItem | null>(null)

  useEffect(() => {
    loadSummary()
    loadBacklog()
    loadHealth()
    loadSuscripciones()
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [financeRefreshTick])

  async function loadSuscripciones() {
    try {
      const res = await api('/finance/data/suscripciones')
      if (res.ok) {
        const data = await res.json()
        setSuscripciones(data.records || [])
      }
    } catch { /* ignore */ }
  }

  async function loadSummary() {
    setSummaryLoading(true)
    try { const res = await api('/finance/summary'); setSummary(await res.json()) }
    catch { /* ignore */ } finally { setSummaryLoading(false) }
  }

  async function loadBacklog() {
    setBacklogLoading(true)
    try {
      const res = await api('/backlog/tasks?limit=6')
      const data = await res.json()
      setBacklogTasks((data ?? []).filter((t: any) => t.status !== 'done').slice(0, 6))
    } catch { /* ignore */ } finally { setBacklogLoading(false) }
  }

  async function loadHealth() {
    setHealthLoading(true)
    try {
      const t = getToken()
      const res = await fetch(`${API_BASE}/health/summary`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      })
      if (res.ok) setHealthData(await res.json())
    } catch { /* ignore */ } finally { setHealthLoading(false) }
  }

  const totalGastos    = Object.values(summary).reduce((acc, s) => acc + (s?.total_cop ?? 0), 0)
  const totalRegistros = Object.values(summary).reduce((acc, s) => acc + (s?.count ?? 0), 0)
  const agentesOnline  = agents.filter(a => a.status === 'online').length || 4
  const fmt  = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
  const fmtM = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n)
  const firstName = user?.name?.split(' ')[0] || 'Freddy'

  const greeting = (() => {
    const h = now.getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const healthSteps = healthData?.latest?.steps
  const healthFC    = healthData?.latest?.heart_rate_avg
  const healthTrend = (healthData?.trend ?? []).slice(0, 7).reverse().map((t: any) => t.steps || 0)

  const statCards = [
    {
      label:   'Gastos Totales',
      value:   summaryLoading ? '—' : `$${fmtM(totalGastos)}`,
      sub:     `${totalRegistros} registros`,
      icon:    Wallet,
      link:    '/finance',
      color:   '#7C3AED',
      iconBg:  'bg-violet-500/10 border-violet-500/20',
      iconText:'text-violet-400',
      spark:   [2.1,2.4,2.0,2.7,2.5,2.9,totalGastos/1_000_000||3.1],
    },
    {
      label:   'Agentes Online',
      value:   String(agentesOnline),
      sub:     `de ${agents.length || 8} total`,
      icon:    Bot,
      link:    '/agents',
      color:   '#10B981',
      iconBg:  'bg-emerald-500/10 border-emerald-500/20',
      iconText:'text-emerald-400',
      spark:   [2,3,2,4,3,4,agentesOnline],
    },
    {
      label:   'Pasos hoy',
      value:   healthLoading ? '—' : healthSteps ? `${(healthSteps/1000).toFixed(1)}K` : '—',
      sub:     healthFC ? `FC ${healthFC} bpm` : 'sin datos',
      icon:    Heart,
      link:    '/health',
      color:   '#EF4444',
      iconBg:  'bg-red-500/10 border-red-500/20',
      iconText:'text-red-400',
      spark:   healthTrend.length > 1 ? healthTrend : [0,0,0,0,0,0,0],
    },
    {
      label:   'Logs de Sistema',
      value:   String(logs.length),
      sub:     `${logs.filter(l => l.level === 'error').length} errores`,
      icon:    Activity,
      link:    '/logs',
      color:   '#F59E0B',
      iconBg:  'bg-amber-500/10 border-amber-500/20',
      iconText:'text-amber-400',
      spark:   [8,12,9,14,11,16,logs.length||17],
    },
  ]

  const financeBreakdown = [
    { label: 'Compras', icon: ShoppingCart, color: '#7C3AED', amount: summary.shops?.total_cop ?? 0,  count: summary.shops?.count ?? 0  },
    { label: 'Canasta', icon: ShoppingCart, color: '#06B6D4', amount: summary.basket?.total_cop ?? 0, count: summary.basket?.count ?? 0 },
    { label: 'Ahorro',  icon: PiggyBank,    color: '#10B981', amount: summary.ahorro?.total_cop ?? 0, count: summary.ahorro?.count ?? 0 },
    { label: 'Deudas',  icon: AlertCircle,  color: '#EF4444', amount: summary.debts?.total_cop ?? 0,  count: summary.debts?.count ?? 0  },
  ]

  // ── Próximos vencimientos (TCs + Suscripciones) ──────────────────────────
  const TC_CORTES = [
    { nombre: 'Nubank',      color: '#820AD1', dia: 15, cardType: 'Mastercard',     last4: '8126' },
    { nombre: 'Lulo Bank',   color: '#00D26A', dia: 21, cardType: 'Mastercard',     last4: '••••' },
    { nombre: 'Bancolombia', color: '#FDDA24', dia: 15, cardType: 'Amex',           last4: '4928' },
    { nombre: 'Falabella',   color: '#BDD732', dia: 19, cardType: 'CMR Mastercard', last4: '6518' },
  ]
  const CAT_COLORS: Record<string, string> = {
    entretenimiento: '#A855F7', trabajo: '#3B82F6', herramientas: '#06B6D4',
    salud: '#10B981', educacion: '#F59E0B', otros: '#6B7280',
  }
  const MONTH_ES_H = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

  function nextDays(dia: number): { date: Date; days: number } | null {
    if (!dia || isNaN(dia)) return null
    const today = new Date()
    let c = new Date(today.getFullYear(), today.getMonth(), dia)
    if (c <= today) c = new Date(today.getFullYear(), today.getMonth() + 1, dia)
    return { date: c, days: Math.ceil((c.getTime() - today.getTime()) / 86400000) }
  }

  const upcomingItems: UpcomingItem[] = [
    ...TC_CORTES.map(tc => {
      const next = nextDays(tc.dia)
      return next ? {
        nombre: tc.nombre, tipo: 'TC' as const, color: tc.color, ...next,
        tcDetails: { cardType: tc.cardType, last4: tc.last4, dia: tc.dia },
      } : null
    }).filter(Boolean) as UpcomingItem[],
    ...suscripciones
      .filter(s => (s.ESTADO || '').toLowerCase() === 'activa' && s.DIA_COBRO)
      .map(s => {
        const dia = parseInt(String(s.DIA_COBRO))
        const next = nextDays(dia)
        const color = CAT_COLORS[(s.CATEGORIA || '').toLowerCase()] ?? '#6B7280'
        return next ? {
          nombre: s.NOMBRE, tipo: 'Sus' as const, color, ...next,
          susDetails: {
            descripcion: s.DESCRIPCION || '',
            precio: parseFloat(String(s.PRECIO)) || 0,
            moneda: s.MONEDA || 'COP',
            ciclo: s.CICLO || 'mensual',
            tarjeta: s.TARJETA || '',
            url: s.URL || '',
            estado: s.ESTADO || '',
            categoria: s.CATEGORIA || '',
            dia,
          },
        } : null
      }).filter(Boolean) as UpcomingItem[],
  ].sort((a, b) => a.days - b.days)

  const quickLinks = [
    { name: 'Finanzas', desc: 'Control financiero', path: '/finance',  icon: Wallet,     color: '#10B981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
    { name: 'Health',   desc: 'Salud y bienestar',  path: '/health',   icon: Heart,      color: '#EF4444', bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400'     },
    { name: 'Backlog',  desc: 'Tareas pendientes',  path: '/backlog',  icon: Layers,     color: '#8B5CF6', bg: 'bg-violet-500/10', border: 'border-violet-500/20',  text: 'text-violet-400'  },
    { name: 'GrowData', desc: 'Datos de negocio',   path: '/growdata', icon: TrendingUp, color: '#06B6D4', bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',    text: 'text-cyan-400'    },
  ]

  // ── Helpers para el modal ────────────────────────────────────────────────
  function fmtPrice(precio: number, moneda: string): string {
    if (moneda === 'COP') return `${Math.round(precio).toLocaleString('es-CO')} (COP)`
    if (moneda === 'USD') return `${precio % 1 === 0 ? precio : precio.toFixed(2)} (USD)`
    if (moneda === 'EUR') return `€${precio % 1 === 0 ? precio : precio.toFixed(2)} (EUR)`
    return `${Math.round(precio).toLocaleString('es-CO')} (${moneda})`
  }
  const CICLO_LABEL: Record<string, string> = { mensual: 'Mensual', anual: 'Anual', trimestral: 'Trimestral', semanal: 'Semanal' }
  const CAT_LABEL: Record<string, string>   = { entretenimiento: 'Entretenimiento', trabajo: 'Trabajo', herramientas: 'Herramientas', salud: 'Salud', educacion: 'Educación', otros: 'Otros' }

  return (
    <div className="flex-1 overflow-auto" style={{ background: 'var(--bg)' }}>
      {/* Hero header */}
      <div className="relative px-5 md:px-7 pt-7 pb-5 overflow-hidden">
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

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryLoading
            ? [0,1,2,3].map(i => <SkeletonCard key={i} />)
            : statCards.map(({ label, value, sub, icon: Icon, link, color, iconBg, iconText, spark }) => (
              <Link key={label} to={link}
                className="group relative rounded-2xl p-4 border border-white/[0.06] bg-card card-hover overflow-hidden">
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

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Finance */}
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
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="pt-3 mt-2 border-t border-white/[0.05] flex items-center justify-between">
                    <span className="text-xs text-slate-500">Total</span>
                    <span className="text-sm font-bold font-mono gradient-text">{fmt(totalGastos)}</span>
                  </div>

                  {/* ── Próximos vencimientos ─────────────────────────── */}
                  {upcomingItems.length > 0 && (
                    <div className="pt-3 mt-1 border-t border-white/[0.05] space-y-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] text-slate-600 uppercase tracking-wide font-medium">Próximos cobros</span>
                      </div>
                      {upcomingItems.slice(0, 8).map((item, i) => {
                        const urgency = item.days <= 3 ? '#EF4444' : item.days <= 7 ? '#F59E0B' : '#4B5563'
                        return (
                          <div key={i}
                            className="flex items-center gap-2 py-1 px-1.5 -mx-1.5 rounded-lg cursor-pointer hover:bg-white/[0.04] transition-colors"
                            onClick={() => setSelectedUpcoming(item)}
                          >
                            {item.tipo === 'TC'
                              ? <CreditCard size={9} style={{ color: item.color, flexShrink: 0 }} />
                              : <Repeat2   size={9} style={{ color: item.color, flexShrink: 0 }} />
                            }
                            <span className="text-[11px] text-slate-400 flex-1 truncate">{item.nombre}</span>
                            <span className="text-[10px] font-mono text-slate-600 shrink-0">
                              {item.date.getDate()} {MONTH_ES_H[item.date.getMonth()]}
                            </span>
                            <span className="text-[10px] font-medium w-8 text-right shrink-0" style={{ color: urgency }}>
                              {item.days}d
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }
          </div>

          {/* Backlog */}
          <div className="rounded-2xl border border-white/[0.06] bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Backlog</h3>
                <p className="text-[11px] text-slate-600 mt-0.5">Tareas pendientes</p>
              </div>
              <Link to="/backlog" className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-primary transition-colors">
                Ver todo <ArrowUpRight size={11} />
              </Link>
            </div>
            {backlogLoading
              ? <div className="space-y-2"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
              : backlogTasks.length === 0
                ? <EmptyState icon={Layers} title="Sin tareas pendientes" description="El backlog esta vacio" />
                : (
                  <div className="space-y-1.5">
                    {backlogTasks.map((task) => {
                      const p  = PRIORITY_STYLES[task.priority] ?? { dot: 'bg-slate-500', label: task.priority }
                      const st = STATUS_LABEL[task.status]       ?? { label: task.status, color: 'text-slate-500' }
                      return (
                        <div key={task.id} className="flex items-start gap-2.5 py-2 border-b border-white/[0.04] last:border-0">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${p.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-300 truncate">{task.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {task.project && <span className="text-[10px] text-slate-700 truncate max-w-[80px]">{task.project}</span>}
                              <span className={`text-[10px] ${st.color}`}>{st.label}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-600 flex-shrink-0">{p.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )
            }
          </div>

          {/* Calendar */}
          <CalendarWidget />

          {/* Email Inbox */}
          <EmailWidget />
        </div>

        {/* Quick access */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Acceso rapido</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickLinks.map(({ name, desc, path, icon: Icon, color, bg, border, text }) => (
              <Link key={name} to={path}
                className="group relative rounded-2xl p-4 border border-white/[0.06] bg-card overflow-hidden card-hover">
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

      {/* ── Modal detalle próximo cobro ──────────────────────────────────────── */}
      {selectedUpcoming && (() => {
        const item = selectedUpcoming
        const urgency = item.days <= 3 ? '#EF4444' : item.days <= 7 ? '#F59E0B' : '#10B981'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={() => setSelectedUpcoming(null)}
          >
            <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl"
              style={{ background: 'var(--card)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
                    {item.tipo === 'TC'
                      ? <CreditCard size={18} style={{ color: item.color }} />
                      : <Repeat2   size={18} style={{ color: item.color }} />
                    }
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-tight">{item.nombre}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: `${item.color}20`, color: item.color }}>
                      {item.tipo === 'TC' ? 'Tarjeta de crédito' : 'Suscripción'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedUpcoming(null)}
                  className="text-slate-600 hover:text-slate-300 transition-colors mt-0.5">
                  <X size={16} />
                </button>
              </div>

              {/* Countdown banner */}
              <div className="mx-5 mb-4 rounded-xl p-3 flex items-center justify-between"
                style={{ background: `${urgency}10`, border: `1px solid ${urgency}25` }}>
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} style={{ color: urgency }} />
                  <span className="text-xs text-slate-300">
                    {item.date.getDate()} {MONTH_ES_H[item.date.getMonth()]} {item.date.getFullYear()}
                  </span>
                </div>
                <span className="text-sm font-bold" style={{ color: urgency }}>
                  {item.days === 0 ? 'Hoy' : item.days === 1 ? 'Mañana' : `${item.days} días`}
                </span>
              </div>

              {/* TC details */}
              {item.tipo === 'TC' && item.tcDetails && (
                <div className="px-5 pb-5 space-y-2">
                  <Row label="Tipo de tarjeta" value={item.tcDetails.cardType} />
                  <Row label="Últimos 4 dígitos" value={`•••• ${item.tcDetails.last4}`} />
                  <Row label="Día de corte" value={`Día ${item.tcDetails.dia} de cada mes`} />
                  <div className="pt-3 mt-1 border-t border-white/[0.05]">
                    <Link to="/finance?tab=credito"
                      onClick={() => setSelectedUpcoming(null)}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors">
                      <ExternalLink size={11} /> Ver extractos en Finance
                    </Link>
                  </div>
                </div>
              )}

              {/* Subscription details */}
              {item.tipo === 'Sus' && item.susDetails && (() => {
                const s = item.susDetails
                const catColor = CAT_COLORS[s.categoria.toLowerCase()] ?? '#6B7280'
                return (
                  <div className="px-5 pb-5 space-y-2">
                    {s.descripcion && <p className="text-xs text-slate-500 mb-3">{s.descripcion}</p>}
                    <Row label="Precio" value={fmtPrice(s.precio, s.moneda)} />
                    <Row label="Ciclo" value={CICLO_LABEL[s.ciclo] ?? s.ciclo} />
                    <Row label="Día de cobro" value={`Día ${s.dia} de cada mes`} />
                    {s.tarjeta && <Row label="Tarjeta" value={s.tarjeta} />}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[11px] text-slate-600">Categoría</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: `${catColor}20`, color: catColor }}>
                        <Tag size={9} className="inline mr-1" />
                        {CAT_LABEL[s.categoria.toLowerCase()] ?? s.categoria}
                      </span>
                    </div>
                    {s.url && (
                      <div className="pt-3 mt-1 border-t border-white/[0.05]">
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors">
                          <ExternalLink size={11} /> Abrir sitio web
                        </a>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0">
      <span className="text-[11px] text-slate-600">{label}</span>
      <span className="text-[11px] text-slate-300 font-medium">{value}</span>
    </div>
  )
}