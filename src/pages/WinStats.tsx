import { useState, useEffect } from 'react'
import { Trophy, Target, Award, Calendar, Zap, Wifi, WifiOff, ExternalLink, RefreshCw, Users, Database, Activity } from 'lucide-react'

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

  const stats = [
    { label: 'Victorias Totales', value: '47', change: '+12%', positive: true, icon: Trophy },
    { label: 'Win Rate',          value: '73%', change: '+5%',  positive: true, icon: Target },
    { label: 'Proyectos Activos', value: '23',  change: '+3',   positive: true, icon: Zap    },
    { label: 'Cierre Este Mes',   value: '8',   change: '-2',   positive: false, icon: Calendar },
  ]

  const recentWins = [
    { client: 'Alcaldía de Bogotá',          value: '$450M', date: '15 Mar 2026', type: 'SECOP II'   },
    { client: 'Instituto Nacional de Salud', value: '$180M', date: '8 Mar 2026',  type: 'Licitación' },
    { client: 'Superintendencia de Salud',   value: '$320M', date: '1 Mar 2026',  type: 'Concurso'   },
    { client: 'MinTIC',                      value: '$890M', date: '22 Feb 2026', type: 'Cooperativa'},
  ]

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">WinStats</h1>
          <p className="text-sm text-slate-500 mt-1">Análisis de victorias y pipeline comercial</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-accent bg-accent/15 px-3 py-1.5 rounded-full border border-accent/30">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          Sistema Activo
        </div>
      </div>

      {/* WinStats Platform Widget */}
      <div className={`border rounded-xl p-5 transition-colors ${
        summary?.online
          ? 'bg-card border-green-500/20'
          : 'bg-card border-border'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-center">
              <Activity size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">WinStats Platform</h3>
              <p className="text-[10px] text-slate-500">Analítica de fútbol · Multi-agente IA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSummary}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <a
              href={WS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 bg-accent/10 hover:bg-accent/15 border border-accent/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              Abrir plataforma <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
            <RefreshCw size={14} className="animate-spin" />
            Conectando con WinStats...
          </div>
        ) : !summary?.online ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
            <WifiOff size={14} className="text-red-400" />
            <span className="text-red-400">Plataforma offline</span>
            <span className="text-slate-600 text-xs">— Asegúrate de que el servidor esté corriendo en {WS_URL}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status + key metrics */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <Wifi size={12} />
                <span>Online</span>
              </div>
              <span className="text-slate-700">·</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Database size={12} className="text-primary" />
                <span className="font-mono">{summary.matches.toLocaleString()}</span>
                <span className="text-slate-500">partidos</span>
              </div>
              <span className="text-slate-700">·</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Trophy size={12} className="text-yellow-400" />
                <span className="font-mono">{summary.competitions}</span>
                <span className="text-slate-500">competiciones</span>
              </div>
              <span className="text-slate-700">·</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Zap size={12} className="text-accent" />
                <span className="font-mono">${summary.today_cost.toFixed(4)}</span>
                <span className="text-slate-500">hoy</span>
              </div>
              {lastFetch && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-[10px] text-slate-600">
                    Actualizado {lastFetch.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>

            {/* Managers */}
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Users size={10} /> Agentes
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.managers).map(([name, status]) => (
                  <div
                    key={name}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${MANAGER_COLORS[status]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${MANAGER_DOTS[status]}`} />
                    {name}
                  </div>
                ))}
              </div>
            </div>

            {/* Last activity */}
            {summary.last_activity && (
              <div className="text-xs text-slate-500 border-t border-border/50 pt-3">
                Última actividad:
                <span className="text-slate-300 ml-1">{summary.last_activity.agent}</span>
                <span className="mx-1">·</span>
                <span className="text-slate-400">{summary.last_activity.action}</span>
                <span className="text-slate-600 ml-1">{summary.last_activity.time}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Business Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <stat.icon size={18} className="text-accent" />
              <span className={`text-xs font-medium ${stat.positive ? 'text-success' : 'text-danger'}`}>
                {stat.change}
              </span>
            </div>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-white">Tendencia de Victorias</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-xs bg-accent/15 text-accent rounded-lg border border-accent/30">Mensual</button>
            <button className="px-3 py-1 text-xs text-slate-500 hover:text-slate-300">Trimestral</button>
          </div>
        </div>
        <div className="flex items-end gap-3 h-40">
          {[65,80,45,90,75,95,70,85,60,88,72,92].map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-accent/30 hover:bg-accent/50 rounded-t transition-colors cursor-pointer" style={{ height: `${val}%` }} />
              <span className="text-[10px] text-slate-600">{['E','F','M','A','M','J','Jl','A','S','O','N','D'][i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Wins */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Últimas Victorias</h3>
          <button className="text-xs text-accent hover:text-accent/80 transition-colors">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-slate-600 uppercase tracking-wider">
                <th className="text-left pb-3">Cliente</th>
                <th className="text-left pb-3">Tipo</th>
                <th className="text-right pb-3">Valor</th>
                <th className="text-right pb-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentWins.map((win, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Award size={14} className="text-accent" />
                      <span className="text-sm text-slate-200">{win.client}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-xs text-slate-500 bg-slate-500/10 px-2 py-1 rounded">{win.type}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-mono text-success">{win.value}</span>
                  </td>
                  <td className="py-3 text-right text-xs text-slate-500">{win.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pipeline */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Pipeline de Oportunidades</h3>
        <div className="space-y-3">
          {[
            { stage: 'Propuesta Enviada', count: 5, value: '$2.1B', color: 'bg-blue-500'  },
            { stage: 'Negociación',        count: 3, value: '$890M', color: 'bg-yellow-500'},
            { stage: 'Ganado',             count: 8, value: '$1.8B', color: 'bg-success'  },
            { stage: 'Perdido',            count: 2, value: '$450M', color: 'bg-danger'   },
          ].map((stage, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`w-2 h-10 rounded-full ${stage.color}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300">{stage.stage}</span>
                  <span className="text-xs text-slate-500">{stage.count} oportunidades</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${stage.color} rounded-full`} style={{ width: `${(stage.count / 8) * 100}%` }} />
                </div>
              </div>
              <span className="text-sm font-mono text-white w-20 text-right">{stage.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
