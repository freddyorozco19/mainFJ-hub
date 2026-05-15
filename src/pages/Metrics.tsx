import { useState, useEffect } from 'react'
import { TrendingUp, Cpu, DollarSign, Activity } from 'lucide-react'
import { useDashboard } from '../store/dashboardStore'
import { SkeletonStatCard, Skeleton } from '../components/Skeleton'

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon size={18} /></div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function AgentRow({ name, icon, tokens, cost, pct }: { name: string; icon: string; tokens: number; cost: number; pct: number }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
      <span className="text-lg w-6 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{name}</p>
        <div className="mt-1 h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-mono text-slate-300">{tokens.toLocaleString()} tok</p>
        <p className="text-[10px] text-slate-600">${cost.toFixed(4)}</p>
      </div>
    </div>
  )
}

export function Metrics() {
  const { globalMetrics, agents } = useDashboard()
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t) }, [])
  const maxTokens = Math.max(...agents.map(a => a.totalTokens), 1)

  return (
    <div className="flex-1 p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Metricas</h1>
        <p className="text-sm text-slate-500 mt-0.5">Consumo y costos de la API</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({length:4}).map((_,i) => <SkeletonStatCard key={i} />)
          : <>
              <StatCard icon={Cpu}        label="Tokens totales"  value={globalMetrics.totalTokens.toLocaleString()} sub="todas las sesiones"  color="bg-primary/15 text-primary"  />
              <StatCard icon={DollarSign} label="Costo total"     value={`$${globalMetrics.totalCost.toFixed(4)}`}  sub="USD acumulado"      color="bg-success/15 text-success"  />
              <StatCard icon={TrendingUp} label="Peticiones"      value={String(globalMetrics.totalRequests)}        sub="llamadas a la API"  color="bg-accent/15 text-accent"    />
              <StatCard icon={Activity}   label="Agentes activos" value={String(globalMetrics.activeAgents)}         sub="habilitados ahora"  color="bg-warning/15 text-warning"  />
            </>
        }
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Uso por agente</h2>
        {loading
          ? <div className="space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-12 w-full" />)}</div>
          : agents.length === 0
            ? <p className="text-sm text-slate-600 py-4 text-center">Sin datos aun — empieza a chatear</p>
            : agents.map(a => <AgentRow key={a.id} name={a.name} icon={a.icon} tokens={a.totalTokens} cost={a.totalCost} pct={(a.totalTokens/maxTokens)*100} />)
        }
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Actividad diaria</h2>
        <p className="text-xs text-slate-600 mb-6">Tokens consumidos por dia</p>
        <div className="flex items-end gap-2 h-24">
          {Array.from({length:14},(_,i) => {
            const h = 20 + (i * 4.5) % 75
            return <div key={i} className="flex-1"><div className="w-full bg-primary/30 rounded-t-sm hover:bg-primary/60 transition-colors cursor-pointer" style={{height:`${h}%`}} /></div>
          })}
        </div>
        <p className="text-[10px] text-slate-700 text-center mt-3">Ultimos 14 dias</p>
      </div>
    </div>
  )
}
