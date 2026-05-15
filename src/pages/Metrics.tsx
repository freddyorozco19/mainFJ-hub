import { useState, useEffect } from 'react'
import { TrendingUp, Cpu, DollarSign, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { useDashboard } from '../store/dashboardStore'
import { SkeletonStatCard, Skeleton } from '../components/Skeleton'

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 hover:-translate-y-0.5 hover:shadow-glow-hover transition-all duration-200">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon size={18} /></div>
      <div>
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-600 mt-1">{sub}</p>
      </div>
    </div>
  )
}

const CHART_COLORS = ['#7C3AED', '#06B6D4', '#4ADE80', '#FBBF24', '#F87171', '#A78BFA', '#34D399']

const TOOLTIP_STYLE = {
  backgroundColor: '#161628',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: 12,
}

export function Metrics() {
  const { agents, logs } = useDashboard()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [])

  const totalTokens   = agents.reduce((s, a) => s + a.totalTokens, 0)
  const totalCost     = agents.reduce((s, a) => s + a.totalCost,   0)
  const activeAgents  = agents.filter(a => a.enabled).length
  const errorLogs     = logs.filter(l => l.level === 'error').length

  // Bar chart: tokens per agent
  const tokenData = agents
    .filter(a => a.totalTokens > 0)
    .map(a => ({ name: a.name.split('/')[0].trim().slice(0, 10), tokens: a.totalTokens, cost: a.totalCost }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 7)

  // Mock token trend (last 7 days)
  const trendData = [
    { day: 'L', tokens: 1200 }, { day: 'M', tokens: 2800 }, { day: 'X', tokens: 1900 },
    { day: 'J', tokens: 3400 }, { day: 'V', tokens: 2100 }, { day: 'S', tokens: 800  },
    { day: 'D', tokens: totalTokens > 0 ? totalTokens : 1500 },
  ]

  // Pie chart: requests by log level
  const levelCounts: Record<string, number> = {}
  logs.forEach(l => { levelCounts[l.level] = (levelCounts[l.level] ?? 0) + 1 })
  const pieData = Object.entries(levelCounts).map(([name, value]) => ({ name, value }))
  const PIE_COLORS: Record<string, string> = { info: '#7C3AED', success: '#4ADE80', warn: '#FBBF24', error: '#F87171' }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div>
        <h1 className="text-xl font-bold text-white">Métricas</h1>
        <p className="text-sm text-slate-500 mt-0.5">Uso de agentes e infraestructura</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
        ) : (
          <>
            <StatCard icon={TrendingUp} label="Tokens Totales"  value={totalTokens.toLocaleString()} sub="Acumulado histórico" color="bg-primary/10 text-primary" />
            <StatCard icon={DollarSign} label="Costo Total"     value={`$${totalCost.toFixed(4)}`}    sub="USD acumulado"       color="bg-success/10 text-success" />
            <StatCard icon={Activity}   label="Agentes Activos" value={String(activeAgents)}           sub={`de ${agents.length} configurados`} color="bg-accent/10 text-accent" />
            <StatCard icon={Cpu}        label="Errores (logs)"  value={String(errorLogs)}              sub="Eventos de error"    color="bg-danger/10 text-danger" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart: token trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tokens esta semana</h3>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="tokens" radius={[4, 4, 0, 0]}>
                  {trendData.map((_, i) => <Cell key={i} fill={i === trendData.length - 1 ? '#7C3AED' : '#7C3AED66'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart: log levels */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Distribución de logs</h3>
          {loading ? (
            <div className="flex items-center justify-center h-44"><Skeleton className="w-36 h-36 rounded-full" /></div>
          ) : pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={72} strokeWidth={0}>
                  {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-44 text-sm text-slate-600">Sin datos de logs aún</div>
          )}
        </div>
      </div>

      {/* Agent table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-white">Detalle por agente</h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-border">
                  <th className="text-left px-5 py-3">Agente</th>
                  <th className="text-right px-5 py-3">Tokens</th>
                  <th className="text-right px-5 py-3">Costo</th>
                  <th className="text-right px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a, i) => (
                  <tr key={a.id} className={`border-b border-border/50 last:border-0 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{a.icon}</span>
                        <span className="text-slate-300 font-medium">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-400">{a.totalTokens.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-400">${a.totalCost.toFixed(4)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <div className="relative w-2 h-2">
                          {a.status === 'online' && <span className="absolute inset-0 rounded-full bg-success/40 animate-ping" />}
                          <span className={`relative block w-2 h-2 rounded-full ${a.status==='online'?'bg-success':a.status==='busy'?'bg-warning':a.status==='error'?'bg-danger':'bg-slate-600'}`} />
                        </div>
                        <span className={`text-[10px] ${a.status==='online'?'text-success':a.status==='busy'?'text-warning':a.status==='error'?'text-danger':'text-slate-500'}`}>
                          {a.status==='online'?'En linea':a.status==='busy'?'Ocupado':a.status==='error'?'Error':'Offline'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tokens by agent bar chart */}
      {!loading && tokenData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tokens por agente</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tokenData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                {tokenData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
