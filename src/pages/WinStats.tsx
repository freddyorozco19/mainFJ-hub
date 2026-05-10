import { useState, useEffect } from 'react'
import {
  Trophy, Wifi, WifiOff, ExternalLink, RefreshCw,
  Database, Activity, BarChart3, Users, Zap,
  FileSpreadsheet, Globe, Radar, TrendingUp,
  ArrowRight, Clock, Bot,
} from 'lucide-react'

const WS_URL = import.meta.env.VITE_WINSTATS_URL || 'http://localhost:8000'

interface ManagerStatuses {
  [key: string]: 'working' | 'idle' | 'error'
}

interface WSSummary {
  online: boolean
  matches: number
  competitions: number
  managers: ManagerStatuses
  today_cost: number
  today_tokens: number
  last_activity: { agent: string; action: string; time: string } | null
  server_time: string
}

const MANAGER_COLORS: Record<string, string> = {
  working: 'text-green-400 bg-green-400/10 border-green-400/20',
  idle:    'text-slate-400 bg-slate-400/10 border-slate-400/20',
  error:   'text-red-400 bg-red-400/10 border-red-400/20',
}

const MANAGER_DOTS: Record<string, string> = {
  working: 'bg-green-400 animate-pulse',
  idle:    'bg-slate-600',
  error:   'bg-red-400',
}

const MANAGER_ICONS: Record<string, string> = {
  'CEO WS':   '🧠',
  'Data':     '💾',
  'Analytics':'📊',
  'Reports':  '📄',
  'Content':  '✍️',
  'Business': '💼',
}

const DATA_SOURCES = [
  { name: 'Opta F24',    desc: 'Eventos de partido en tiempo real',      icon: Zap,             color: 'primary' },
  { name: 'Wyscout',     desc: 'Métricas avanzadas de jugadores',        icon: TrendingUp,      color: 'accent'  },
  { name: 'FBref',       desc: 'Estadísticas históricas y percentiles',  icon: BarChart3,       color: 'success' },
  { name: 'Google Drive',desc: 'Almacenamiento y sincronización',        icon: FileSpreadsheet, color: 'warning' },
]

const CAPABILITIES = [
  { icon: Radar,     title: 'Radar Charts',       desc: 'Visualización de perfiles de jugadores con percentiles por posición y liga.' },
  { icon: Activity,  title: 'Match Analysis',     desc: 'Desglose de eventos Opta F24: pases, xG, heatmaps, presión y zonas de juego.' },
  { icon: Users,     title: 'Player Scouting',    desc: 'Búsqueda avanzada de jugadores por métricas, edad, liga y perfil táctico.' },
  { icon: Bot,       title: 'Multi-Agente IA',    desc: 'Sistema de agentes especializados que coordinan análisis, reportes y contenido.' },
  { icon: Globe,     title: 'Multi-Liga',         desc: 'Cobertura de 16+ competiciones internacionales con datos históricos.' },
  { icon: Database,  title: 'Data Pipeline',      desc: 'ETL automatizado desde fuentes externas a parquet en Drive, con 15K+ partidos.' },
]

export function WinStats() {
  const [summary, setSummary] = useState<WSSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchSummary = async () => {
    try {
      const r = await fetch(`${WS_URL}/api/summary`, { signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        setSummary(await r.json())
        setLastFetch(new Date())
      } else {
        setSummary(s => s ? { ...s, online: false } : null)
      }
    } catch {
      setSummary(s => s ? { ...s, online: false } : { online: false } as any)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
    const id = setInterval(fetchSummary, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center">
              <Trophy size={16} className="text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-white">WinStats</h1>
          </div>
          <p className="text-sm text-slate-500">Plataforma de analítica de fútbol · Multi-agente IA</p>
        </div>
        <a
          href={WS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-lg hover:bg-accent/15 transition-colors"
        >
          Abrir plataforma <ExternalLink size={11} />
        </a>
      </div>

      {/* Live connection widget */}
      <div className={`border rounded-xl p-5 transition-colors ${summary?.online ? 'bg-card border-accent/20' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-center">
              <Activity size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Estado del sistema</h3>
              <p className="text-[10px] text-slate-500">Datos en vivo desde la plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchSummary} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
            <RefreshCw size={14} className="animate-spin" /> Conectando con WinStats...
          </div>
        ) : !summary?.online ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
            <WifiOff size={14} className="text-red-400" />
            <span className="text-red-400">Plataforma offline</span>
            <span className="text-slate-600 text-xs">— inicia el servidor local en {WS_URL}</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                  <Wifi size={10} className="text-green-400" /> Estado
                </div>
                <p className="text-sm font-bold text-green-400">Online</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{summary.server_time}</p>
              </div>

              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                  <Database size={10} className="text-primary" /> Partidos
                </div>
                <p className="text-xl font-bold text-white">{summary.matches.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">en base de datos</p>
              </div>

              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                  <Trophy size={10} className="text-yellow-400" /> Competiciones
                </div>
                <p className="text-xl font-bold text-white">{summary.competitions}</p>
                <p className="text-[10px] text-slate-500">indexadas</p>
              </div>

              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                  <Zap size={10} className="text-accent" /> Costo hoy
                </div>
                <p className="text-xl font-bold text-white">${summary.today_cost.toFixed(4)}</p>
                <p className="text-[10px] text-slate-500">{summary.today_tokens.toLocaleString()} tokens</p>
              </div>
            </div>

            {/* Managers grid */}
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2.5">Agentes del sistema</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(summary.managers).map(([name, status]) => (
                  <div
                    key={name}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${MANAGER_COLORS[status]}`}
                  >
                    <span className="text-base leading-none">{MANAGER_ICONS[name] ?? '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{name}</p>
                      <p className="text-[10px] opacity-60 capitalize">{status}</p>
                    </div>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${MANAGER_DOTS[status]}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Last activity */}
            {summary.last_activity && (
              <div className="flex items-center gap-2 text-xs text-slate-500 border-t border-border/50 pt-3">
                <Clock size={11} />
                <span>Última actividad:</span>
                <span className="text-slate-300">{summary.last_activity.agent}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400 truncate">{summary.last_activity.action}</span>
                <span className="text-slate-600 ml-auto flex-shrink-0">{summary.last_activity.time}</span>
              </div>
            )}

            {lastFetch && (
              <p className="text-[10px] text-slate-700">
                Actualizado {lastFetch.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Data sources */}
      <div>
        <h3 className="text-xs font-medium text-slate-600 uppercase tracking-widest mb-3">Fuentes de datos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DATA_SOURCES.map((src, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg bg-${src.color}/10 border border-${src.color}/20 flex items-center justify-center flex-shrink-0`}>
                <src.icon size={14} className={`text-${src.color}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{src.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{src.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities */}
      <div>
        <h3 className="text-xs font-medium text-slate-600 uppercase tracking-widest mb-3">Capacidades</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CAPABILITIES.map((cap, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 hover:border-accent/20 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-3">
                <cap.icon size={16} className="text-accent" />
              </div>
              <h4 className="text-sm font-semibold text-white mb-1.5">{cap.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{cap.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white mb-1">Explorar la plataforma</h3>
          <p className="text-sm text-slate-400">
            Accede a análisis de partidos, perfiles de jugadores y reportes del sistema multi-agente.
          </p>
        </div>
        <a
          href={WS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors ml-4"
        >
          Abrir <ArrowRight size={14} />
        </a>
      </div>

    </div>
  )
}
