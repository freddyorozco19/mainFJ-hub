import { useState, useEffect } from 'react'
import { Brain, Cpu, Zap, Clock, Database, FileText, MessageSquare, Bot, ExternalLink, RefreshCw, TrendingUp, FolderKanban, FileCheck, Target } from 'lucide-react'

const PORTAL_URL = 'https://architechia-portal.vercel.app'

interface PortalSummary {
  online: boolean
  leads: number
  leads_won: number
  win_rate: number
  pipeline_value: number
  proposals_total: number
  proposals_accepted: number
  proposals_pending: number
  projects_active: number
  projects_completed: number
  avg_progress: number
  activities: number
  updated_at: string
}

export function ExpertIA() {
  const [portal, setPortal] = useState<PortalSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPortal = async () => {
    try {
      const r = await fetch(`${PORTAL_URL}/api/public-summary`, { signal: AbortSignal.timeout(8000) })
      if (r.ok) setPortal(await r.json())
      else setPortal(p => p ? { ...p, online: false } : null)
    } catch {
      setPortal(p => p ? { ...p, online: false } : { online: false } as any)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPortal()
    const id = setInterval(fetchPortal, 60000)
    return () => clearInterval(id)
  }, [])

  const agents = [
    { name: 'Abogado IA',       icon: '⚖️', desc: 'Análisis legal, contratos, cláusulas',      status: 'online',  tasks: 24 },
    { name: 'Contador IA',      icon: '📊', desc: 'Estados financieros, impuestos, auditoría',  status: 'online',  tasks: 18 },
    { name: 'Médico IA',        icon: '🏥', desc: 'Diagnóstico, análisis clínico, síntomas',    status: 'busy',    tasks: 12 },
    { name: 'Ingeniero IA',     icon: '🔧', desc: 'Diseño técnico, cálculos, especificaciones', status: 'online',  tasks: 31 },
    { name: 'Data Scientist IA',icon: '📈', desc: 'ML, estadísticas, modelos predictivos',      status: 'offline', tasks: 0  },
    { name: 'Marketing IA',     icon: '📢', desc: 'Campañas, SEO, contenido, redes sociales',   status: 'online',  tasks: 15 },
  ]

  const capabilities = [
    { title: 'Procesamiento de Documentos', desc: 'Analiza contratos, facturas, reportes', icon: FileText,     count: '1.2K docs' },
    { title: 'Chat Especializado',          desc: 'Consultas técnicas con contexto domain', icon: MessageSquare, count: '3.4K chats' },
    { title: 'Base de Conocimiento',        desc: 'Memoria persistente por especialidad',  icon: Database,      count: '890 MB'    },
    { title: 'APIs Especializadas',         desc: 'Integración con sistemas externos',     icon: Cpu,           count: '12 APIs'   },
  ]

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ArchiTechIA</h1>
          <p className="text-sm text-slate-500 mt-1">Agentes expertos especializados por dominio</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-success bg-success/15 px-3 py-1.5 rounded-full border border-success/30">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Sistema Activo
        </div>
      </div>

      {/* Portal Widget */}
      <div className={`border rounded-xl p-5 transition-colors ${portal?.online ? 'bg-card border-success/20' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-success/10 border border-success/20 rounded-lg flex items-center justify-center">
              <Brain size={16} className="text-success" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">ArchiTechIA Portal</h3>
              <p className="text-[10px] text-slate-500">CRM · Pipeline · Proyectos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchPortal} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <a
              href={PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-success hover:text-success/80 bg-success/10 hover:bg-success/15 border border-success/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              Abrir portal <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
            <RefreshCw size={14} className="animate-spin" /> Conectando con el portal...
          </div>
        ) : !portal?.online ? (
          <div className="text-sm text-red-400 py-2">Portal no disponible</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                <TrendingUp size={10} /> Pipeline
              </div>
              <p className="text-lg font-bold text-white">{portal.leads}</p>
              <p className="text-[10px] text-slate-500">leads activos</p>
              <div className="mt-1 text-[10px] text-success font-mono">
                Win rate {portal.win_rate}%
              </div>
            </div>

            <div className="bg-black/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                <FileCheck size={10} /> Propuestas
              </div>
              <p className="text-lg font-bold text-white">{portal.proposals_total}</p>
              <p className="text-[10px] text-slate-500">total</p>
              <div className="mt-1 text-[10px] text-primary font-mono">
                {portal.proposals_accepted} aceptadas · {portal.proposals_pending} pendientes
              </div>
            </div>

            <div className="bg-black/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                <FolderKanban size={10} /> Proyectos
              </div>
              <p className="text-lg font-bold text-white">{portal.projects_active}</p>
              <p className="text-[10px] text-slate-500">en curso</p>
              <div className="mt-1 flex items-center gap-1">
                <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${portal.avg_progress}%` }} />
                </div>
                <span className="text-[10px] text-slate-500">{portal.avg_progress}%</span>
              </div>
            </div>

            <div className="bg-black/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                <Target size={10} /> Pipeline valor
              </div>
              <p className="text-lg font-bold text-white">
                ${portal.pipeline_value >= 1000 ? `${(portal.pipeline_value / 1000).toFixed(0)}K` : portal.pipeline_value}
              </p>
              <p className="text-[10px] text-slate-500">USD estimado</p>
              <div className="mt-1 text-[10px] text-slate-500 font-mono">
                {portal.activities} actividades
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Brain,       color: 'success', value: '6',     label: 'Agentes Expertos'  },
          { icon: MessageSquare, color: 'primary', value: '100', label: 'Consultas Hoy'     },
          { icon: Zap,         color: 'accent',   value: '99.2%',label: 'Disponibilidad'    },
          { icon: Clock,       color: 'warning',  value: '1.2s', label: 'Tiempo Promedio'   },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-${s.color}/15 flex items-center justify-center`}>
              <s.icon size={22} className={`text-${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Agents Grid */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Agentes Disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent, i) => (
            <div key={i} className={`bg-card border rounded-xl p-5 hover:border-success/30 transition-all ${agent.status === 'offline' ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{agent.icon}</div>
                <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full ${
                  agent.status === 'online'  ? 'text-success bg-success/15' :
                  agent.status === 'busy'    ? 'text-warning bg-warning/15' :
                                               'text-slate-500 bg-slate-500/15'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    agent.status === 'online' ? 'bg-success' :
                    agent.status === 'busy'   ? 'bg-warning animate-pulse' :
                                                'bg-slate-500'
                  }`} />
                  {agent.status === 'online' ? 'Online' : agent.status === 'busy' ? 'Ocupado' : 'Offline'}
                </span>
              </div>
              <h4 className="text-base font-semibold text-white mb-1">{agent.name}</h4>
              <p className="text-xs text-slate-500 mb-3">{agent.desc}</p>
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-1 text-[10px] text-slate-600">
                  <Bot size={10} /><span>{agent.tasks} tareas</span>
                </div>
                <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-success hover:text-success/80 transition-colors">
                  Consultar →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Capacidades</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {capabilities.map((cap, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-3">
                <cap.icon size={18} className="text-success" />
              </div>
              <h4 className="text-sm font-medium text-white mb-1">{cap.title}</h4>
              <p className="text-xs text-slate-500 mb-2">{cap.desc}</p>
              <span className="text-[10px] font-mono text-success bg-success/10 px-2 py-0.5 rounded">{cap.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Chat */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Consulta Rápida</h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Escribe tu consulta a ExpertIA..."
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-success/40"
          />
          <button className="px-6 py-3 bg-success text-white rounded-xl text-sm font-medium hover:bg-success/90 transition-colors">
            Consultar
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-2">
          Selecciona un agente experto o deja que ExpertIA enrute tu consulta automáticamente
        </p>
      </div>
    </div>
  )
}
