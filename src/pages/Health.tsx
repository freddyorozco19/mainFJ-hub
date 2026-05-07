import { useState, useEffect, type ReactNode } from 'react'
import {
  Heart, Footprints, Moon, Activity, Zap, Wind,
  RefreshCw, Calendar, TrendingUp, Clock,
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'
const HEALTH_KEY = 'mainfj-health-2026-fj'

interface HealthDay {
  id: number
  date: string
  steps: number | null
  calories: number | null
  heart_rate_avg: number | null
  heart_rate_min: number | null
  heart_rate_max: number | null
  hrv: number | null
  spo2: number | null
  sleep_hours: number | null
  sleep_deep: number | null
  sleep_rem: number | null
  sleep_awake: number | null
  active_energy: number | null
  distance_km: number | null
  synced_at: string | null
}

interface Summary {
  latest: Partial<HealthDay>
  weekly: {
    avg_steps: number
    avg_hr: number
    avg_sleep: number
    avg_hrv: number
    total_calories: number
    days_tracked: number
  }
  trend: Partial<HealthDay>[]
}

const fmt = (v: number | null | undefined, dec = 0) =>
  v != null ? Number(v).toFixed(dec) : '–'

const TABS = ['Dashboard', 'Historial', 'Analytics'] as const
type Tab = (typeof TABS)[number]

const H = { 'x-health-key': HEALTH_KEY, 'Content-Type': 'application/json' }

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function MetricCard({ icon, label, value, unit, color, barVal, barMax, barColor }: {
  icon: ReactNode; label: string; value: string; unit: string
  color: string; barVal: number; barMax: number; barColor: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className={`flex items-center gap-2 ${color} mb-1`}>
        {icon}<span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>
        {value} <span className="text-xs text-gray-500">{unit}</span>
      </p>
      <ProgressBar value={barVal} max={barMax} color={barColor} />
    </div>
  )
}

function ChartBar({ title, data, getValue, max, color, unit }: {
  title: string
  data: Partial<HealthDay>[]
  getValue: (d: Partial<HealthDay>) => number
  max: number
  color: string
  unit: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-sm text-gray-400 mb-4">{title}</p>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">Sin datos</p>
      ) : (
        <div className="flex items-end gap-1 h-32">
          {data.map((d, i) => {
            const val = getValue(d)
            const pct = max > 0 ? (val / max) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute -top-6 bg-gray-700 text-white text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {val.toFixed(1)} {unit}
                </div>
                <div
                  className={`w-full ${color} rounded-t transition-all`}
                  style={{ height: `${pct}%`, minHeight: val > 0 ? '4px' : '0' }}
                />
                <p className="text-gray-600 text-[9px] rotate-45 origin-left">
                  {(d.date ?? '').slice(5)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Health() {
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard')
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [history, setHistory]     = useState<HealthDay[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [loading, setLoading]     = useState(false)

  const loadSummary = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/health/summary`, { headers: H })
      if (r.ok) setSummary(await r.json())
    } finally { setLoading(false) }
  }

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('start', startDate)
      if (endDate)   params.set('end',   endDate)
      const r = await fetch(`${API}/health/data?${params}`, { headers: H })
      if (r.ok) setHistory(await r.json())
    } finally { setLoading(false) }
  }

  useEffect(() => { loadSummary() }, [])
  useEffect(() => {
    if (activeTab === 'Historial' || activeTab === 'Analytics') loadHistory()
  }, [activeTab])

  const latest = summary?.latest ?? {}
  const weekly = summary?.weekly ?? ({} as Summary['weekly'])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="text-red-400" size={28} /> Health
          </h1>
          <p className="text-gray-400 text-sm mt-1">Amazfit Helio Strap · via Apple Health</p>
        </div>
        <button
          onClick={loadSummary}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="flex gap-1 bg-gray-800 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Dashboard' && (
        <div className="space-y-6">
          <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 text-sm text-blue-300">
            <span className="font-semibold">Ultimo sync:</span>{' '}
            {latest.synced_at
              ? new Date(latest.synced_at).toLocaleString('es-CO')
              : 'Sin datos aun'}
            {' · '}
            <span className="text-blue-400">Ejecuta el Shortcut de iOS para sincronizar</span>
          </div>

          <p className="text-xs text-gray-400 uppercase tracking-widest">
            Hoy · {latest.date ?? '–'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={<Footprints size={20} />} label="Pasos"       value={fmt(latest.steps)}          unit="pasos" color="text-green-400"  barVal={latest.steps ?? 0}          barMax={10000} barColor="bg-green-500" />
            <MetricCard icon={<Heart size={20} />}       label="Frec. Card." value={fmt(latest.heart_rate_avg)} unit="bpm"   color="text-red-400"    barVal={latest.heart_rate_avg ?? 0} barMax={100}   barColor="bg-red-500" />
            <MetricCard icon={<Moon size={20} />}        label="Sueno"       value={fmt(latest.sleep_hours, 1)} unit="hrs"   color="text-purple-400" barVal={latest.sleep_hours ?? 0}    barMax={9}     barColor="bg-purple-500" />
            <MetricCard icon={<Zap size={20} />}         label="Calorias"    value={fmt(latest.calories)}       unit="kcal"  color="text-orange-400" barVal={latest.calories ?? 0}       barMax={600}   barColor="bg-orange-500" />
            <MetricCard icon={<Activity size={20} />}    label="HRV"         value={fmt(latest.hrv, 1)}         unit="ms"    color="text-cyan-400"   barVal={latest.hrv ?? 0}            barMax={100}   barColor="bg-cyan-500" />
            <MetricCard icon={<Wind size={20} />}        label="SpO2"        value={fmt(latest.spo2, 1)}        unit="%"     color="text-teal-400"   barVal={latest.spo2 ?? 0}           barMax={100}   barColor="bg-teal-500" />
            <MetricCard icon={<TrendingUp size={20} />}  label="Distancia"   value={fmt(latest.distance_km, 2)} unit="km"    color="text-yellow-400" barVal={latest.distance_km ?? 0}    barMax={10}    barColor="bg-yellow-500" />
            <MetricCard icon={<Clock size={20} />}       label="E. Activa"   value={fmt(latest.active_energy)}  unit="kcal"  color="text-pink-400"   barVal={latest.active_energy ?? 0}  barMax={500}   barColor="bg-pink-500" />
          </div>

          {(latest.sleep_deep != null || latest.sleep_rem != null) && (
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                <Moon size={16} /> Detalle de sueno
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-purple-400 text-xl font-bold">{fmt(latest.sleep_deep, 1)}h</p><p className="text-xs text-gray-500">Profundo</p></div>
                <div><p className="text-blue-400   text-xl font-bold">{fmt(latest.sleep_rem, 1)}h</p> <p className="text-xs text-gray-500">REM</p></div>
                <div><p className="text-gray-400   text-xl font-bold">{fmt(latest.sleep_awake, 1)}h</p><p className="text-xs text-gray-500">Despierto</p></div>
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-3 flex items-center gap-2">
              <Calendar size={16} /> Promedio ultimos 7 dias · {weekly.days_tracked ?? 0} dias registrados
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div><p className="text-green-400  text-lg font-bold">{fmt(weekly.avg_steps)}</p>     <p className="text-xs text-gray-500">Pasos</p></div>
              <div><p className="text-red-400    text-lg font-bold">{fmt(weekly.avg_hr)}</p>        <p className="text-xs text-gray-500">FC promedio</p></div>
              <div><p className="text-purple-400 text-lg font-bold">{fmt(weekly.avg_sleep, 1)}h</p><p className="text-xs text-gray-500">Sueno</p></div>
              <div><p className="text-cyan-400   text-lg font-bold">{fmt(weekly.avg_hrv, 1)}</p>   <p className="text-xs text-gray-500">HRV</p></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Historial' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Desde</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Hasta</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            <button onClick={loadHistory}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Filtrar
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>
                  {['Fecha','Pasos','FC avg','FC min','FC max','Sueno','HRV','SpO2','Calorias','Distancia'].map(h => (
                    <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={10} className="text-center text-gray-500 py-8">Sin datos. Ejecuta el Shortcut de iOS.</td></tr>
                ) : history.map(row => (
                  <tr key={row.id} className="border-t border-gray-700 hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{row.date}</td>
                    <td className="px-4 py-3 text-green-400">{fmt(row.steps)}</td>
                    <td className="px-4 py-3 text-red-400">{fmt(row.heart_rate_avg)}</td>
                    <td className="px-4 py-3 text-red-300">{fmt(row.heart_rate_min)}</td>
                    <td className="px-4 py-3 text-red-500">{fmt(row.heart_rate_max)}</td>
                    <td className="px-4 py-3 text-purple-400">{fmt(row.sleep_hours, 1)}h</td>
                    <td className="px-4 py-3 text-cyan-400">{fmt(row.hrv, 1)}</td>
                    <td className="px-4 py-3 text-teal-400">{fmt(row.spo2, 1)}%</td>
                    <td className="px-4 py-3 text-orange-400">{fmt(row.calories)}</td>
                    <td className="px-4 py-3 text-yellow-400">{fmt(row.distance_km, 2)} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Analytics' && (
        <div className="space-y-8">
          {(() => {
            const data    = [...history].reverse().slice(-14)
            const maxStep = Math.max(...data.map(d => d.steps ?? 0), 1)
            const maxHR   = Math.max(...data.map(d => d.heart_rate_avg ?? 0), 1)
            return (
              <>
                <ChartBar title="Pasos diarios (ultimos 14 dias)" data={data} getValue={d => d.steps ?? 0}          max={maxStep} color="bg-green-500"  unit="pasos" />
                <ChartBar title="Frecuencia cardiaca promedio"     data={data} getValue={d => d.heart_rate_avg ?? 0} max={maxHR}   color="bg-red-500"    unit="bpm"   />
                <ChartBar title="Horas de sueno"                   data={data} getValue={d => d.sleep_hours ?? 0}   max={9}       color="bg-purple-500" unit="hrs"   />
                <ChartBar title="HRV"                              data={data} getValue={d => d.hrv ?? 0}           max={100}     color="bg-cyan-500"   unit="ms"    />
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}