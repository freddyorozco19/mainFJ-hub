import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Layers, GraduationCap, ShoppingCart, ArrowUpRight, Zap, Activity, Moon, Footprints } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API_BASE, getToken } from '../api'
import { SkeletonCard } from '../components/Skeleton'

const MODULES = [
  {
    name: 'Health',
    desc: 'Salud y bienestar',
    path: '/health',
    icon: Heart,
    color: '#EF4444',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
  },
  {
    name: 'Backlog',
    desc: 'Tareas pendientes',
    path: '/backlog',
    icon: Layers,
    color: '#8B5CF6',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
  },
  {
    name: 'Certificaciones',
    desc: 'Exámenes y progreso',
    path: '/certifications',
    icon: GraduationCap,
    color: '#10B981',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
  },
  {
    name: 'Rappi Scan',
    desc: 'Rastreo de precios',
    path: '/rappi-prices',
    icon: ShoppingCart,
    color: '#F97316',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
  },
]

export function HomeReadonly() {
  const { user } = useAuth()
  const [healthData, setHealthData] = useState<any>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    loadHealth()
    return () => clearInterval(t)
  }, [])

  async function loadHealth() {
    setHealthLoading(true)
    try {
      const t = getToken()
      const res = await fetch(`${API_BASE}/health/summary`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      })
      if (res.ok) setHealthData(await res.json())
    } catch { /* ignore */ } finally {
      setHealthLoading(false)
    }
  }

  const firstName = user?.name?.split(' ')[0] || 'Sarita'

  const greeting = (() => {
    const h = now.getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const latest = healthData?.latest
  const steps = latest?.steps
  const fc = latest?.heart_rate_avg
  const sleep = latest?.sleep_hours
  const trend = (healthData?.trend ?? []).slice(0, 7).reverse()

  const healthStats = [
    {
      label: 'Pasos hoy',
      value: steps ? `${(steps / 1000).toFixed(1)}K` : '—',
      icon: Footprints,
      color: '#EF4444',
      iconBg: 'bg-red-500/10 border-red-500/20',
      iconText: 'text-red-400',
    },
    {
      label: 'Frec. cardíaca',
      value: fc ? `${fc} bpm` : '—',
      icon: Activity,
      color: '#F97316',
      iconBg: 'bg-orange-500/10 border-orange-500/20',
      iconText: 'text-orange-400',
    },
    {
      label: 'Sueño',
      value: sleep ? `${sleep.toFixed(1)}h` : '—',
      icon: Moon,
      color: '#8B5CF6',
      iconBg: 'bg-violet-500/10 border-violet-500/20',
      iconText: 'text-violet-400',
    },
  ]

  return (
    <div className="flex-1 overflow-auto" style={{ background: 'var(--bg)' }}>
      {/* Hero */}
      <div className="relative px-5 md:px-7 pt-7 pb-5 overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 100% at 20% -20%, rgba(124,58,237,0.12) 0%, transparent 70%)' }}
        />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.5)]">
                <Zap size={10} className="text-white" />
              </div>
              <span className="text-xs text-slate-600 font-medium">FJ Hub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {greeting}, <span className="gradient-text">{firstName}</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              {now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-7 pb-8 space-y-6">

        {/* Health snapshot */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Salud · hoy</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
            <Link to="/health" className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-primary transition-colors">
              Ver más <ArrowUpRight size={11} />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {healthLoading
              ? [0, 1, 2].map(i => <SkeletonCard key={i} />)
              : healthStats.map(({ label, value, icon: Icon, color, iconBg, iconText }) => (
                <div
                  key={label}
                  className="relative rounded-2xl p-4 border border-white/[0.06] bg-card overflow-hidden"
                >
                  <div
                    className="absolute inset-0 pointer-events-none rounded-2xl"
                    style={{ background: `radial-gradient(circle at top left, ${color}0D 0%, transparent 60%)` }}
                  />
                  <div className="relative">
                    <div className={`w-8 h-8 ${iconBg} border rounded-lg flex items-center justify-center mb-3`}>
                      <Icon size={14} className={iconText} />
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">{value}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Steps mini trend */}
          {!healthLoading && trend.length > 1 && (
            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-card p-4">
              <p className="text-[11px] text-slate-600 mb-2">Pasos · últimos 7 días</p>
              <div className="flex items-end gap-1 h-10">
                {trend.map((d: any, i: number) => {
                  const max = Math.max(...trend.map((t: any) => t.steps || 0)) || 1
                  const pct = ((d.steps || 0) / max) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className="w-full rounded-sm bg-red-500/40 transition-all"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                        title={`${d.date}: ${d.steps ?? 0} pasos`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Module cards */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Módulos</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MODULES.map(({ name, desc, path, icon: Icon, color, bg, border, text }) => (
              <Link
                key={name}
                to={path}
                className="group relative rounded-2xl p-4 border border-white/[0.06] bg-card overflow-hidden card-hover"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `radial-gradient(circle at bottom right, ${color}0D 0%, transparent 60%)` }}
                />
                <div className="relative">
                  <div className={`w-10 h-10 ${bg} border ${border} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon size={18} className={text} />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">{name}</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">{desc}</p>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight size={14} className="text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
