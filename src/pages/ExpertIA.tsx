import { useState, useEffect } from 'react'
import {
  Brain, ExternalLink, RefreshCw, TrendingUp, FolderKanban,
  FileCheck, Target, Users, Sparkles, Code2, BarChart3,
  Workflow, ShieldCheck, ArrowRight, CheckCircle2, Clock3,
  XCircle, Activity,
} from 'lucide-react'

const PORTAL_URL = 'https://architechia-portal.vercel.app'
const IS_DEV = import.meta.env.DEV
const SUMMARY_URL = IS_DEV
  ? '/portal-proxy/public-summary'
  : `${PORTAL_URL}/api/public-summary`

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

const SERVICES = [
  {
    icon: Brain,
    title: 'Agentes IA',
    desc: 'Automatización inteligente con agentes especializados por dominio: legal, financiero, datos y más.',
    color: 'primary',
  },
  {
    icon: Code2,
    title: 'Desarrollo a medida',
    desc: 'Soluciones de software hechas para tu negocio: APIs, dashboards, integraciones y pipelines de datos.',
    color: 'accent',
  },
  {
    icon: BarChart3,
    title: 'Analítica avanzada',
    desc: 'Visualización de datos, KPIs en tiempo real, modelos predictivos y reportes ejecutivos automatizados.',
    color: 'success',
  },
  {
    icon: Workflow,
    title: 'Automatización',
    desc: 'Flujos de trabajo automáticos con n8n, webhooks y orquestación de procesos empresariales.',
    color: 'warning',
  },
  {
    icon: ShieldCheck,
    title: 'Consultoría técnica',
    desc: 'Arquitectura de sistemas, auditoría de infraestructura y estrategia de transformación digital.',
    color: 'success',
  },
  {
    icon: Sparkles,
    title: 'IA Generativa',
    desc: 'Integración de LLMs (Claude, GPT) en productos: chatbots, procesamiento de documentos y asistentes.',
    color: 'primary',
  },
]

const PORTAL_LINKS = [
  { label: 'Pipeline de leads',  path: '/leads',     icon: TrendingUp  },
  { label: 'Propuestas',         path: '/proposals',  icon: FileCheck   },
  { label: 'Proyectos activos',  path: '/projects',   icon: FolderKanban},
  { label: 'Clientes',           path: '/clientes',   icon: Users       },
]

function ProposalBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-white">{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ExpertIA() {
  const [portal, setPortal] = useState<PortalSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPortal = async () => {
    try {
      const r = await fetch(SUMMARY_URL, { signal: AbortSignal.timeout(10000) })
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

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-success/15 border border-success/20 flex items-center justify-center">
              <Brain size={16} className="text-success" />
            </div>
            <h1 className="text-2xl font-bold text-white">ArchiTechIA</h1>
          </div>
          <p className="text-sm text-slate-500">Soluciones de IA y software a medida · Bogotá, Colombia</p>
        </div>
        <a
          href={PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-success bg-success/10 border border-success/20 px-3 py-1.5 rounded-lg hover:bg-success/15 transition-colors"
        >
          Portal <ExternalLink size={11} />
        </a>
      </div>

      {/* Portal Widget — conexión en vivo */}
      <div className={`border rounded-xl p-5 transition-colors ${portal?.online ? 'bg-card border-success/20' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-success/10 border border-success/20 rounded-lg flex items-center justify-center">
              <Activity size={16} className="text-success" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Estado del negocio</h3>
              <p className="text-[10px] text-slate-500">Datos en vivo desde el portal</p>
            </div>
          </div>
          <button onClick={fetchPortal} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
            <RefreshCw size={14} className="animate-spin" /> Conectando con el portal...
          </div>
        ) : !portal?.online ? (
          <div className="text-sm text-red-400 py-2">Portal no disponible</div>
        ) : (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                  <TrendingUp size={10} /> Pipeline
                </div>
                <p className="text-xl font-bold text-white">{portal.leads}</p>
                <p className="text-[10px] text-slate-500">leads totales</p>
                <p className="text-[10px] text-success font-mono mt-1">Win rate {portal.win_rate}%</p>
              </div>

              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                  <Target size={10} /> Valor pipeline
                </div>
                <p className="text-xl font-bold text-white">
                  ${portal.pipeline_value >= 1000 ? `${(portal.pipeline_value / 1000).toFixed(1)}K` : portal.pipeline_value}
                </p>
                <p className="text-[10px] text-slate-500">USD estimado</p>
                <p className="text-[10px] text-primary font-mono mt-1">{portal.leads_won} ganados</p>
              </div>

              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                  <FolderKanban size={10} /> Proyectos
                </div>
                <p className="text-xl font-bold text-white">{portal.projects_active}</p>
                <p className="text-[10px] text-slate-500">en curso</p>
                <div className="mt-1.5 flex items-center gap-1">
                  <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${portal.avg_progress}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500">{portal.avg_progress}%</span>
                </div>
              </div>

              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                  <FileCheck size={10} /> Propuestas
                </div>
                <p className="text-xl font-bold text-white">{portal.proposals_total}</p>
                <p className="text-[10px] text-slate-500">total</p>
                <p className="text-[10px] font-mono mt-1">
                  <span className="text-success">{portal.proposals_accepted} ✓</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-warning">{portal.proposals_pending} ⏳</span>
                </p>
              </div>
            </div>

            {/* Proposals breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/10 rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-slate-400">Propuestas por estado</p>
                <ProposalBar label="Aceptadas" value={portal.proposals_accepted} total={portal.proposals_total} color="bg-success" />
                <ProposalBar label="Pendientes" value={portal.proposals_pending} total={portal.proposals_total} color="bg-warning" />
                <ProposalBar
                  label="Otras"
                  value={portal.proposals_total - portal.proposals_accepted - portal.proposals_pending}
                  total={portal.proposals_total}
                  color="bg-slate-600"
                />
              </div>

              <div className="bg-black/10 rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-slate-400">Estado general</p>
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                  <span className="text-xs text-slate-300">{portal.projects_completed} proyectos completados</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock3 size={14} className="text-primary flex-shrink-0" />
                  <span className="text-xs text-slate-300">{portal.projects_active} proyectos activos</span>
                </div>
                <div className="flex items-center gap-3">
                  <XCircle size={14} className="text-slate-600 flex-shrink-0" />
                  <span className="text-xs text-slate-400">{portal.leads - portal.leads_won} leads en proceso</span>
                </div>
                <div className="flex items-center gap-3">
                  <Activity size={14} className="text-accent flex-shrink-0" />
                  <span className="text-xs text-slate-300">{portal.activities} actividades registradas</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accesos rápidos al portal */}
      {portal?.online && (
        <div>
          <h3 className="text-xs font-medium text-slate-600 uppercase tracking-widest mb-3">Acceso rápido al portal</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PORTAL_LINKS.map(({ label, path, icon: Icon }) => (
              <a
                key={path}
                href={`${PORTAL_URL}${path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-card border border-border hover:border-success/30 rounded-xl px-4 py-3 text-sm text-slate-300 hover:text-white transition-all group"
              >
                <Icon size={15} className="text-slate-500 group-hover:text-success transition-colors" />
                <span className="text-xs">{label}</span>
                <ArrowRight size={11} className="ml-auto text-slate-700 group-hover:text-slate-400 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Servicios */}
      <div>
        <h3 className="text-xs font-medium text-slate-600 uppercase tracking-widest mb-3">Servicios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SERVICES.map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 hover:border-white/10 transition-colors group">
              <div className={`w-10 h-10 rounded-xl bg-${s.color}/10 border border-${s.color}/20 flex items-center justify-center mb-3`}>
                <s.icon size={18} className={`text-${s.color}`} />
              </div>
              <h4 className="text-sm font-semibold text-white mb-1.5">{s.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-success/10 to-primary/10 border border-success/20 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white mb-1">¿Tienes un proyecto en mente?</h3>
          <p className="text-sm text-slate-400">Agenda una sesión de descubrimiento gratuita con el equipo de ArchiTechIA.</p>
        </div>
        <a
          href={`${PORTAL_URL}/leads`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-2 bg-success text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-success/90 transition-colors ml-4"
        >
          Contactar <ArrowRight size={14} />
        </a>
      </div>

    </div>
  )
}
