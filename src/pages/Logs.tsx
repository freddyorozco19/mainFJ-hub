import { useState, useEffect } from 'react'
import { Search, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { useDashboard } from '../store/dashboardStore'
import type { LogEntry } from '../store/dashboardStore'
import { SkeletonTable } from '../components/Skeleton'

const LEVEL_CONFIG = {
  info:    { icon: Info,          color: 'text-accent',  bg: 'bg-accent/10',  label: 'INFO'  },
  success: { icon: CheckCircle,   color: 'text-success', bg: 'bg-success/10', label: 'OK'    },
  warn:    { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', label: 'WARN'  },
  error:   { icon: AlertCircle,   color: 'text-danger',  bg: 'bg-danger/10',  label: 'ERROR' },
}

const DEMO_LOGS: LogEntry[] = [
  { id: '1', timestamp: new Date().toISOString(), level: 'success', agentSlug: 'orchestrator', action: 'CHAT',   detail: 'Respuesta generada correctamente', durationMs: 843 },
  { id: '2', timestamp: new Date().toISOString(), level: 'info',    agentSlug: 'code',         action: 'INIT',   detail: 'Agente inicializado',              durationMs: 12  },
  { id: '3', timestamp: new Date().toISOString(), level: 'info',    agentSlug: 'data',         action: 'INIT',   detail: 'Agente inicializado',              durationMs: 10  },
  { id: '4', timestamp: new Date().toISOString(), level: 'warn',    agentSlug: 'finance',      action: 'CONFIG', detail: 'Agente deshabilitado',             durationMs: undefined },
  { id: '5', timestamp: new Date().toISOString(), level: 'error',   agentSlug: 'habits',       action: 'CHAT',   detail: 'Backend no disponible en :8001',   durationMs: undefined },
]

function LogRow({ log }: { log: LogEntry }) {
  const cfg = LEVEL_CONFIG[log.level]
  const Icon = cfg.icon
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
      <div className={`mt-0.5 p-1 rounded ${cfg.bg}`}><Icon size={11} className={cfg.color} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold font-mono ${cfg.color}`}>{cfg.label}</span>
          <span className="text-[10px] font-mono text-slate-600 bg-border/60 px-1.5 rounded">{log.action}</span>
          <span className="text-[10px] text-slate-500">{log.agentSlug}</span>
          {log.durationMs && <span className="text-[10px] text-slate-700 ml-auto">{log.durationMs}ms</span>}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{log.detail}</p>
      </div>
      <div className="text-[10px] text-slate-700 flex-shrink-0 font-mono">
        {new Date(log.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
      </div>
    </div>
  )
}

export function Logs() {
  const { logs } = useDashboard()
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { const t = setTimeout(() => setLoading(false), 350); return () => clearTimeout(t) }, [])

  const allLogs = logs.length > 0 ? logs : DEMO_LOGS
  const filtered = allLogs.filter(l =>
    (levelFilter === 'all' || l.level === levelFilter) &&
    (!search || l.detail.toLowerCase().includes(search.toLowerCase()) || l.agentSlug.includes(search.toLowerCase()))
  )

  return (
    <div className="flex-1 p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Logs</h1>
        <p className="text-sm text-slate-500 mt-0.5">{allLogs.length} entradas registradas</p>
      </div>
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input type="text" placeholder="Buscar en logs..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-primary/40" />
        </div>
        {(['all','info','success','warn','error'] as const).map(lv => (
          <button key={lv} onClick={() => setLevelFilter(lv)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${levelFilter===lv?'bg-primary/15 border-primary/30 text-primary':'border-border text-slate-500 hover:text-slate-300'}`}>
            {lv==='all'?'Todos':lv.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-4 font-mono">
        {loading
          ? <SkeletonTable rows={6} />
          : filtered.length === 0
            ? <p className="text-xs text-slate-600 py-8 text-center">Sin resultados</p>
            : filtered.map(log => <LogRow key={log.id} log={log} />)
        }
      </div>
    </div>
  )
}
