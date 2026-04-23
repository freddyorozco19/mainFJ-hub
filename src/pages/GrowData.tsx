import { Database, BarChart3, TrendingUp, Target, Clock, Zap } from 'lucide-react'

export function GrowData() {
  const metrics = [
    { label: 'Registros Totales', value: '1.2M', change: '+8%', icon: Database },
    { label: 'Fuentes Activas', value: '24', change: '+2', icon: Zap },
    { label: 'ETL Jobs', value: '156', change: '+12', icon: Clock },
    { label: 'Datasets', value: '48', change: '+5', icon: BarChart3 },
  ]

  const pipelines = [
    { name: 'Ingesta BigQuery', status: 'success', records: '450K', time: '2m' },
    { name: 'Transformación Ventas', status: 'success', records: '89K', time: '5m' },
    { name: 'Reporte Diario', status: 'running', records: '-', time: 'running' },
    { name: 'Sincronización CRM', status: 'warning', records: '12K', time: '3m' },
  ]

  const sources = [
    { name: 'Salesforce', type: 'CRM', records: '45K', lastSync: 'Hace 10 min' },
    { name: 'SAP ERP', type: 'ERP', records: '890K', lastSync: 'Hace 1 hora' },
    { name: 'Google Analytics', type: 'Web', records: '120K', lastSync: 'Hace 30 min' },
    { name: 'Stripe', type: 'Payments', records: '23K', lastSync: 'Hace 5 min' },
  ]

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Grow Data</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión y procesamiento de datos</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-success bg-success/15 px-3 py-1.5 rounded-full border border-success/30">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Sistema Activo
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <metric.icon size={18} className="text-primary" />
              <span className="text-xs font-medium text-success">{metric.change}</span>
            </div>
            <p className="text-3xl font-bold text-white">{metric.value}</p>
            <p className="text-xs text-slate-500 mt-1">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* Pipelines */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Pipelines Activos</h3>
          <button className="text-xs text-primary hover:text-primary/80 transition-colors">Ver todos</button>
        </div>
        <div className="space-y-3">
          {pipelines.map((pipeline, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-surface rounded-lg border border-border">
              <div className={`w-2 h-2 rounded-full ${
                pipeline.status === 'success' ? 'bg-success' :
                pipeline.status === 'running' ? 'bg-primary animate-pulse' :
                'bg-warning'
              }`} />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{pipeline.name}</p>
                <p className="text-xs text-slate-500">{pipeline.records} registros</p>
              </div>
              <span className="text-xs text-slate-500">{pipeline.time}</span>
              <span className={`text-[10px] px-2 py-1 rounded ${
                pipeline.status === 'success' ? 'bg-success/15 text-success' :
                pipeline.status === 'running' ? 'bg-primary/15 text-primary' :
                'bg-warning/15 text-warning'
              }`}>
                {pipeline.status === 'success' ? 'Completado' :
                 pipeline.status === 'running' ? 'Ejecutando' : 'Advertencia'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Sources */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Fuentes de Datos</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-slate-600 uppercase tracking-wider">
                <th className="text-left pb-3">Fuente</th>
                <th className="text-left pb-3">Tipo</th>
                <th className="text-right pb-3">Registros</th>
                <th className="text-right pb-3">Última Sincronización</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Database size={14} className="text-primary" />
                      <span className="text-sm text-slate-200">{source.name}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-xs text-slate-500 bg-slate-500/10 px-2 py-1 rounded">
                      {source.type}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-mono text-white">{source.records}</span>
                  </td>
                  <td className="py-3 text-right text-xs text-slate-500">{source.lastSync}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-primary/40 transition-colors">
            <TrendingUp size={18} className="text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium text-white">Nueva Pipeline</p>
              <p className="text-xs text-slate-500">Crear ETL job</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-primary/40 transition-colors">
            <Target size={18} className="text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium text-white">Nueva Fuente</p>
              <p className="text-xs text-slate-500">Conectar datos</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-primary/40 transition-colors">
            <BarChart3 size={18} className="text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium text-white">Generar Reporte</p>
              <p className="text-xs text-slate-500">Exportar datos</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
