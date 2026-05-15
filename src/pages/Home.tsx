import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bot, MessageSquare, TrendingUp, DollarSign, PiggyBank, AlertCircle, ShoppingCart, Activity, ChevronRight } from 'lucide-react'
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
  const W = 72, H = 22
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H * 0.75) - H * 0.1}`)
  return (
    <svg width={W} height={H} className="opacity-50 flex-shrink-0">
      <path d={`M${pts.join(' L')}`} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Home() {
  const { user } = useAuth()
  const { agents, logs, chatHistories, financeRefreshTick } = useDashboard()
  const [summary, setSummary] = useState<Partial<FinanceSummary>>({})
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [recentRecords, setRecentRecords] = useState<Record<string, string | number>[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)

  useEffect(() => { loadSummary(); loadRecentRecords() }, [financeRefreshTick])

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
      setRecentRecords(all.slice(-5).reverse())
    } catch { /* ignore */ } finally { setRecordsLoading(false) }
  }

  const totalGastos = Object.values(summary).reduce((acc, s) => acc + (s?.total_cop ?? 0), 0)
  const totalRegistros = Object.values(summary).reduce((acc, s) => acc + (s?.count ?? 0), 0)
  const totalConversaciones = Object.values(chatHistories).reduce((acc, msgs) => acc + msgs.length, 0)
  const ultimosLogs = logs.slice(0, 5)
  const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  const quickCards = [
    { label: 'Gastos Totales', value: summaryLoading ? '...' : `${(totalGastos/1_000_000).toFixed(1)}M`, icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', link: '/finance', spark: [2.1,2.4,2.0,2.7,2.5,2.9,totalGastos/1_000_000||3.1], sparkColor: '#7C3AED' },
    { label: 'Registros', value: summaryLoading ? '...' : String(totalRegistros), icon: Activity, color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20', link: '/finance', spark: [12,18,14,20,17,22,totalRegistros||24], sparkColor: '#06B6D4' },
    { label: 'Agentes Online', value: String(agents.filter(a => a.status === 'online').length || 4), icon: Bot, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', link: '/agents', spark: [2,3,2,4,3,4,agents.filter(a=>a.status==='online').length||4], sparkColor: '#4ADE80' },
    { label: 'Conversaciones', value: String(totalConversaciones), icon: MessageSquare, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', link: '/chat', spark: [5,8,6,10,9,12,totalConversaciones||13], sparkColor: '#FBBF24' },
  ]
  const financeBreakdown = [
    { key: 'shops', label: 'Compras', icon: ShoppingCart, color: 'text-primary', amount: summary.shops?.total_cop ?? 0 },
    { key: 'basket', label: 'Canasta', icon: ShoppingCart, color: 'text-accent', amount: summary.basket?.total_cop ?? 0 },
    { key: 'ahorro', label: 'Ahorro', icon: PiggyBank, color: 'text-success', amount: summary.ahorro?.total_cop ?? 0 },
    { key: 'debts', label: 'Deudas', icon: AlertCircle, color: 'text-danger', amount: summary.debts?.total_cop ?? 0 },
  ]
  const systems = [
    { name: 'Agentes', desc: 'Orquestador de IA', path: '/agents', icon: Bot },
    { name: 'Finanzas', desc: 'Gestion y presupuesto', path: '/finance', icon: DollarSign },
    { name: 'Chat', desc: 'Conversaciones con IA', path: '/chat', icon: MessageSquare },
    { name: 'Metricas', desc: 'Analisis de uso', path: '/metrics', icon: TrendingUp },
  ]

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Bienvenido, {user?.name?.split(' ')[0] || 'Usuario'} · Resumen de tu portal</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryLoading && [0,1,2,3].map(i => <SkeletonCard key={i} />)}
        {!summaryLoading && quickCards.map(({ label, value, icon: Icon, color, bg, border, link, spark, sparkColor }: any) => (
          <Link key={label} to={link} className={`bg-card border ${border} rounded-xl p-5 hover:border-opacity-60 hover:-translate-y-0.5 hover:shadow-glow-hover transition-all duration-200 group`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 ${bg} border ${border} rounded-lg flex items-center justify-center`}>
                <Icon size={16} className={color} />
              </div>
              {spark && <Sparkline data={spark} color={sparkColor} />}
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors">
              Ver detalle <ChevronRight size={10} />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Finanzas por categoria</h3>
            <Link to="/finance" className="text-xs text-primary hover:text-primary/80">Ver todo</Link>
          </div>
          {summaryLoading
            ? <div className="space-y-3 py-2"><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
            : <div className="space-y-3">
                {financeBreakdown.map(({ label, icon: Icon, color, amount }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3"><Icon size={14} className={color} /><span className="text-sm text-slate-300">{label}</span></div>
                    <span className="text-sm font-mono text-white">{fmt(amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-sm font-bold font-mono text-primary">{fmt(totalGastos)}</span>
                </div>
              </div>
          }
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Actividad reciente</h3>
            <Link to="/logs" className="text-xs text-primary hover:text-primary/80">Ver logs</Link>
          </div>
          {ultimosLogs.length === 0
            ? <EmptyState icon={Activity} title="Sin actividad reciente" description="Los eventos del sistema apareceran aqui en tiempo real" />
            : <div className="space-y-3">
                {ultimosLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${log.level==='error'?'bg-danger':log.level==='warn'?'bg-warning':log.level==='success'?'bg-success':'bg-primary'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">{log.action}</p>
                      <p className="text-[10px] text-slate-600">{log.agentSlug} · {new Date(log.timestamp).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Ultimos registros</h3>
            <Link to="/finance" className="text-xs text-primary hover:text-primary/80">Ver todo</Link>
          </div>
          {recordsLoading
            ? <div className="space-y-2 py-2"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
            : recentRecords.length === 0
              ? <EmptyState icon={DollarSign} title="Sin registros recientes" />
              : <div className="space-y-3">
                  {recentRecords.map((rec, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300 truncate">{String(rec.PRODUCTO||rec.NOMBRE||rec.CONCEPTO||'Registro')}</p>
                        <p className="text-[10px] text-slate-600">{String(rec._tab)} · {String(rec.FECHA||rec.MES||'')}</p>
                      </div>
                      <span className="text-sm font-mono text-success">{fmt(Number(String(rec.VALOR||0).replace(/\D/g,''))||0)}</span>
                    </div>
                  ))}
                </div>
          }
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Acceso rapido</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {systems.map(sys => (
            <Link key={sys.name} to={sys.path} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <sys.icon size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
              </div>
              <h4 className="text-base font-semibold text-white group-hover:text-primary transition-colors">{sys.name}</h4>
              <p className="text-xs text-slate-500 mt-1">{sys.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
