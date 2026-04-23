import { useState, useEffect } from 'react'
import { Bot, Power, Settings, Cpu, TrendingUp, Clock, X, DollarSign, Calendar, Zap } from 'lucide-react'
import { useDashboard } from '../store/dashboardStore'
import type { Agent } from '../store/dashboardStore'

const DEMO_AGENTS: Agent[] = [
  { id: '1', name: 'CEO / Orquestador', slug: 'orchestrator', category: 'Core',     icon: '🧠', description: 'Coordina todos los agentes, responde preguntas generales y enruta tareas.',         status: 'online',  enabled: true,  model: 'claude-haiku-4-5', totalTokens: 0, totalCost: 0, lastActive: null },
  { id: '2', name: 'Finanzas',          slug: 'finance',      category: 'Life',     icon: '💰', description: 'Controla cuentas bancarias, gastos, presupuesto mensual y metas financieras.',       status: 'offline', enabled: false, model: 'claude-haiku-4-5', totalTokens: 0, totalCost: 0, lastActive: null },
  { id: '3', name: 'Hábitos',           slug: 'habits',       category: 'Life',     icon: '🎯', description: 'Registra y analiza hábitos diarios, rachas, metas de bienestar y productividad.',    status: 'offline', enabled: false, model: 'claude-haiku-4-5', totalTokens: 0, totalCost: 0, lastActive: null },
  { id: '4', name: 'Código',            slug: 'code',         category: 'Work',     icon: '💻', description: 'Python, SQL, BigQuery, ETL Pentaho, debugging y revisión de código.',                status: 'online',  enabled: true,  model: 'claude-haiku-4-5', totalTokens: 0, totalCost: 0, lastActive: null },
  { id: '5', name: 'Datos',             slug: 'data',         category: 'Work',     icon: '📊', description: 'Análisis de datos, queries BigQuery, pandas, KPIs y reportes estadísticos.',         status: 'online',  enabled: true,  model: 'claude-haiku-4-5', totalTokens: 0, totalCost: 0, lastActive: null },
  { id: '6', name: 'Preventa',          slug: 'preventa',     category: 'Work',     icon: '📋', description: 'Propuestas técnicas, licitaciones SECOP II, fichas SIGID, estimaciones de costo.',   status: 'online',  enabled: true,  model: 'claude-haiku-4-5', totalTokens: 0, totalCost: 0, lastActive: null },
  { id: '7', name: 'Investigación',     slug: 'research',     category: 'Work',     icon: '🔍', description: 'Búsqueda de licitaciones, análisis de competidores, síntesis de documentos.',        status: 'offline', enabled: false, model: 'claude-haiku-4-5', totalTokens: 0, totalCost: 0, lastActive: null },
  { id: '8', name: 'Agenda Personal',   slug: 'agenda',       category: 'Life',     icon: '📅', description: 'Gestión de agenda, recordatorios, planificación semanal y seguimiento de compromisos.', status: 'offline', enabled: false, model: 'claude-haiku-4-5', totalTokens: 0, totalCost: 0, lastActive: null },
]

const CATEGORY_COLOR: Record<string, string> = {
  Core: 'text-primary border-primary/30 bg-primary/10',
  Life: 'text-accent border-accent/30 bg-accent/10',
  Work: 'text-success border-success/30 bg-success/10',
}

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  online:  { bg: 'bg-success/15', text: 'text-success', label: 'En línea' },
  busy:    { bg: 'bg-warning/15', text: 'text-warning', label: 'Ocupado' },
  offline: { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Desconectado' },
  error:   { bg: 'bg-danger/15', text: 'text-danger', label: 'Error' },
}

function AgentModal({ agent, onClose, onToggle }: { agent: Agent; onClose: () => void; onToggle: () => void }) {
  const status = STATUS_COLOR[agent.status] ?? STATUS_COLOR.offline
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center text-3xl">
              {agent.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{agent.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border ${CATEGORY_COLOR[agent.category] ?? 'text-slate-400'}`}>
                  {agent.category}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded ${status.bg} ${status.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'online' ? 'bg-success' : agent.status === 'busy' ? 'bg-warning animate-pulse' : agent.status === 'error' ? 'bg-danger' : 'bg-slate-500'}`} />
                  {status.label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Description */}
          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Descripción</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{agent.description}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Cpu size={12} />
                <span className="text-[10px] uppercase tracking-wider">Modelo</span>
              </div>
              <p className="text-sm font-mono text-white">{agent.model.replace('claude-', '')}</p>
            </div>
            <div className="bg-surface rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <TrendingUp size={12} />
                <span className="text-[10px] uppercase tracking-wider">Tokens</span>
              </div>
              <p className="text-sm font-mono text-white">{agent.totalTokens.toLocaleString()}</p>
            </div>
            <div className="bg-surface rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <DollarSign size={12} />
                <span className="text-[10px] uppercase tracking-wider">Costo</span>
              </div>
              <p className="text-sm font-mono text-white">${agent.totalCost.toFixed(4)}</p>
            </div>
            <div className="bg-surface rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Calendar size={12} />
                <span className="text-[10px] uppercase tracking-wider">Última vez</span>
              </div>
              <p className="text-sm text-white">{agent.lastActive ?? 'Nunca'}</p>
            </div>
          </div>

          {/* Slug */}
          <div className="bg-surface rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Zap size={12} />
              <span className="text-[10px] uppercase tracking-wider">Slug</span>
            </div>
            <p className="text-sm font-mono text-primary">{agent.slug}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 p-6 border-t border-border">
          <button
            onClick={onToggle}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              agent.enabled
                ? 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30'
                : 'bg-success/15 text-success hover:bg-success/25 border border-success/30'
            }`}
          >
            <Power size={14} />
            {agent.enabled ? 'Desactivar' : 'Activar'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-violet-500 transition-colors"
          >
            Ir al chat
          </button>
        </div>
      </div>
    </div>
  )
}

function AgentCard({ agent, onToggle, onClick }: { agent: Agent; onToggle: () => void; onClick: () => void }) {
  return (
    <div 
      className={`bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 cursor-pointer hover:border-primary/40 ${
        agent.enabled ? 'border-border hover:shadow-lg hover:shadow-primary/5' : 'border-border/50 opacity-60'
      }`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl leading-none">{agent.icon}</div>
          <div>
            <div className="text-sm font-semibold text-white">{agent.name}</div>
            <div className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[agent.category] ?? 'text-slate-400'}`}>
              {agent.category}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-success' : agent.status === 'busy' ? 'bg-warning animate-pulse' : agent.status === 'error' ? 'bg-danger' : 'bg-slate-600'}`} title={agent.status} />
          <button
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            className={`p-1.5 rounded-lg transition-colors ${
              agent.enabled
                ? 'text-primary bg-primary/10 hover:bg-primary/20'
                : 'text-slate-600 bg-white/5 hover:bg-white/10 hover:text-slate-400'
            }`}
          >
            <Power size={13} />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{agent.description}</p>

      {/* Footer stats */}
      <div className="flex items-center gap-3 pt-1 border-t border-border/60">
        <div className="flex items-center gap-1 text-[10px] text-slate-600">
          <Cpu size={10} />
          <span className="font-mono">{agent.model.replace('claude-', '')}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-600">
          <TrendingUp size={10} />
          <span>{agent.totalTokens.toLocaleString()} tok</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-600 ml-auto">
          <Clock size={10} />
          <span>{agent.lastActive ?? 'nunca'}</span>
        </div>
      </div>
    </div>
  )
}

export function Agents() {
  const { agents, setAgents, toggleAgent } = useDashboard()
  const [filter, setFilter] = useState<string>('Todos')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  useEffect(() => {
    if (agents.length === 0) setAgents(DEMO_AGENTS)
  }, [])

  const list = agents.length > 0 ? agents : DEMO_AGENTS

  const categories = ['Todos', ...Array.from(new Set(list.map(a => a.category)))]
  const filtered = filter === 'Todos' ? list : list.filter(a => a.category === filter)
  const enabled  = list.filter(a => a.enabled).length

  const handleToggle = (agentId: string) => {
    toggleAgent(agentId)
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(prev => prev ? { ...prev, enabled: !prev.enabled } : null)
    }
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Agentes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{enabled} activos · {list.length} total</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 border border-border rounded-lg hover:border-primary/40 hover:text-primary transition-colors">
          <Settings size={13} />
          Configurar
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filter === cat
                ? 'bg-primary/15 border-primary/30 text-primary'
                : 'border-border text-slate-500 hover:text-slate-300 hover:border-border'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onToggle={() => handleToggle(agent.id)}
            onClick={() => setSelectedAgent(agent)}
          />
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <Bot size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No hay agentes en esta categoría</p>
        </div>
      )}

      {/* Agent Modal */}
      {selectedAgent && (
        <AgentModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onToggle={() => handleToggle(selectedAgent.id)}
        />
      )}
    </div>
  )
}
