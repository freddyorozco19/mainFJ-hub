import { Trophy, Target, Award, Calendar, Zap } from 'lucide-react'

export function WinStats() {
  const stats = [
    { label: 'Victorias Totales', value: '47', change: '+12%', positive: true, icon: Trophy },
    { label: 'Win Rate', value: '73%', change: '+5%', positive: true, icon: Target },
    { label: 'Proyectos Activos', value: '23', change: '+3', positive: true, icon: Zap },
    { label: 'Cierre Este Mes', value: '8', change: '-2', positive: false, icon: Calendar },
  ]

  const recentWins = [
    { client: 'Alcaldía de Bogotá', value: '$450M', date: '15 Mar 2026', type: 'SECOP II' },
    { client: 'Instituto Nacional de Salud', value: '$180M', date: '8 Mar 2026', type: 'Licitación' },
    { client: 'Superintendencia de Salud', value: '$320M', date: '1 Mar 2026', type: 'Concurso' },
    { client: 'MinTIC', value: '$890M', date: '22 Feb 2026', type: 'Cooperativa' },
  ]

  return (
    <div className="flex-1 p-6 space-y-6">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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

      {/* Chart Placeholder */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-white">Tendencia de Victorias</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-xs bg-accent/15 text-accent rounded-lg border border-accent/30">Mensual</button>
            <button className="px-3 py-1 text-xs text-slate-500 hover:text-slate-300">Trimestral</button>
          </div>
        </div>
        <div className="flex items-end gap-3 h-40">
          {[65, 80, 45, 90, 75, 95, 70, 85, 60, 88, 72, 92].map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div 
                className="w-full bg-accent/30 hover:bg-accent/50 rounded-t transition-colors cursor-pointer"
                style={{ height: `${val}%` }}
              />
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
                    <span className="text-xs text-slate-500 bg-slate-500/10 px-2 py-1 rounded">
                      {win.type}
                    </span>
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
            { stage: 'Propuesta Enviada', count: 5, value: '$2.1B', color: 'bg-blue-500' },
            { stage: 'Negociación', count: 3, value: '$890M', color: 'bg-yellow-500' },
            { stage: 'Ganado', count: 8, value: '$1.8B', color: 'bg-success' },
            { stage: 'Perdido', count: 2, value: '$450M', color: 'bg-danger' },
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
