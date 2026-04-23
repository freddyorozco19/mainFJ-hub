import { Bot, MessageSquare, Trophy, TrendingUp } from 'lucide-react'

export function Home() {
  const systems = [
    { name: 'MainFJ', icon: '', desc: 'Orquestador principal', path: '/agents', status: 'online', color: 'primary' },
    { name: 'WinStats', icon: '', desc: 'Análisis de victorias y estadísticas', path: '/winstats', status: 'online', color: 'accent' },
    { name: 'ArchiTechIA', icon: '', desc: 'Agentes expertos especializados', path: '/expertia', status: 'online', color: 'success' },
    { name: 'Grow Data', icon: '', desc: 'Gestión y procesamiento de datos', path: '/growdata', status: 'online', color: 'primary' },
    { name: 'LIFE', icon: '', desc: 'Hábitos y bienestar personal', path: '/life', status: 'online', color: 'accent' },
  ]

  return (
    <div className="flex-1 p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Home</h1>
        <p className="text-sm text-slate-500 mt-1">Panel de control centralizado</p>
      </div>

      {/* Systems Grid */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Sistemas Conectados</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {systems.map(sys => (
            <div
              key={sys.name}
              className={`group bg-card border border-border rounded-xl p-5 hover:border-${sys.color}/40 transition-all duration-200 hover:shadow-lg hover:shadow-${sys.color}/5`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-base font-bold text-slate-400">{sys.name}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-success bg-success/15 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Online
                </span>
              </div>
              <h4 className="text-base font-semibold text-white group-hover:text-primary transition-colors">
                {sys.name}
              </h4>
              <p className="text-xs text-slate-500 mt-1">{sys.desc}</p>
              {sys.name === 'WinStats' ? (
                <a
                  href="http://localhost:5173"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-accent/15 text-accent text-xs font-medium rounded-lg border border-accent/30 hover:bg-accent/25 transition-colors"
                >
                  
                  Open...
                  <span className="text-accent/60">→</span>
                </a>
              ) : (
                <a
                  href={sys.path}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary text-xs font-medium rounded-lg border border-primary/30 hover:bg-primary/25 transition-colors"
                >
                  Abrir
                  <span className="text-primary/60">→</span>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Bot size={14} />
            <span className="text-[10px] uppercase tracking-wider">Agentes Activos</span>
          </div>
          <p className="text-2xl font-bold text-white">4</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <MessageSquare size={14} />
            <span className="text-[10px] uppercase tracking-wider">Conversaciones</span>
          </div>
          <p className="text-2xl font-bold text-white">127</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <TrendingUp size={14} />
            <span className="text-[10px] uppercase tracking-wider">Tokens Hoy</span>
          </div>
          <p className="text-2xl font-bold text-white">12.4K</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Trophy size={14} />
            <span className="text-[10px] uppercase tracking-wider">Sistemas</span>
          </div>
          <p className="text-2xl font-bold text-white">5</p>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Actividad Reciente</h3>
        <div className="space-y-3">
          {[
            { time: 'Hace 2 min', action: 'Chat con Código', agent: 'MainFJ', icon: '💻' },
            { time: 'Hace 15 min', action: 'Métricas actualizadas', agent: 'Sistema', icon: '📊' },
            { time: 'Hace 1 hora', action: 'Nuevo agente activado', agent: 'Preventa', icon: '🎯' },
            { time: 'Hace 2 horas', action: 'Logs exportados', agent: 'Logs', icon: '📋' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-slate-300">{item.action}</p>
                <p className="text-[10px] text-slate-600">{item.agent}</p>
              </div>
              <span className="text-[10px] text-slate-600">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
