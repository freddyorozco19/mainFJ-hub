import { Brain, Cpu, Zap, Clock, Database, FileText, MessageSquare, Bot } from 'lucide-react'

export function ExpertIA() {
  const agents = [
    { name: 'Abogado IA', icon: '⚖️', desc: 'Análisis legal, contratos, cláusulas', status: 'online', tasks: 24 },
    { name: 'Contador IA', icon: '📊', desc: 'Estados financieros, impuestos, auditoría', status: 'online', tasks: 18 },
    { name: 'Médico IA', icon: '🏥', desc: 'Diagnóstico, análisis clínico, síntomas', status: 'busy', tasks: 12 },
    { name: 'Ingeniero IA', icon: '🔧', desc: 'Diseño técnico, cálculos, especificaciones', status: 'online', tasks: 31 },
    { name: 'Data Scientist IA', icon: '📈', desc: 'ML, estadísticas, modelos predictivos', status: 'offline', tasks: 0 },
    { name: 'Marketing IA', icon: '📢', desc: 'Campañas, SEO, contenido, redes sociales', status: 'online', tasks: 15 },
  ]

  const capabilities = [
    { title: 'Procesamiento de Documentos', desc: 'Analiza contratos, facturas, reportes', icon: FileText, count: '1.2K docs' },
    { title: 'Chat Especializado', desc: 'Consultas técnicas con contexto domain', icon: MessageSquare, count: '3.4K chats' },
    { title: 'Base de Conocimiento', desc: 'Memoria persistente por especialidad', icon: Database, count: '890 MB' },
    { title: 'APIs Especializadas', desc: 'Integración con sistemas externos', icon: Cpu, count: '12 APIs' },
  ]

  return (
    <div className="flex-1 p-6 space-y-6">
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center">
            <Brain size={22} className="text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">6</p>
            <p className="text-xs text-slate-500">Agentes Expertos</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <MessageSquare size={22} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">100</p>
            <p className="text-xs text-slate-500">Consultas Hoy</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center">
            <Zap size={22} className="text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">99.2%</p>
            <p className="text-xs text-slate-500">Disponibilidad</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-warning/15 flex items-center justify-center">
            <Clock size={22} className="text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">1.2s</p>
            <p className="text-xs text-slate-500">Tiempo Promedio</p>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Agentes Disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent, i) => (
            <div key={i} className={`bg-card border rounded-xl p-5 transition-all duration-200 hover:border-success/30 ${
              agent.status === 'offline' ? 'opacity-50' : ''
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{agent.icon}</div>
                <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full ${
                  agent.status === 'online' ? 'text-success bg-success/15' :
                  agent.status === 'busy' ? 'text-warning bg-warning/15' :
                  'text-slate-500 bg-slate-500/15'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    agent.status === 'online' ? 'bg-success' :
                    agent.status === 'busy' ? 'bg-warning animate-pulse' :
                    'bg-slate-500'
                  }`} />
                  {agent.status === 'online' ? 'Online' : agent.status === 'busy' ? 'Ocupado' : 'Offline'}
                </span>
              </div>
              <h4 className="text-base font-semibold text-white mb-1">{agent.name}</h4>
              <p className="text-xs text-slate-500 mb-3">{agent.desc}</p>
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-1 text-[10px] text-slate-600">
                  <Bot size={10} />
                  <span>{agent.tasks} tareas</span>
                </div>
                <button className="text-xs text-success hover:text-success/80 transition-colors">
                  Consultar →
                </button>
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
              <span className="text-[10px] font-mono text-success bg-success/10 px-2 py-0.5 rounded">
                {cap.count}
              </span>
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
