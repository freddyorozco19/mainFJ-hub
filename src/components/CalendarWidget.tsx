import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Users, ChevronRight, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'

interface CalEvent {
  uid: string
  summary: string
  start: string
  end: string
  start_date: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  duration_min: number
  location: string | null
  organizer: string | null
  attendee_count: number
}

const DAY_LABELS: Record<string, string> = {
  Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mié',
  Thursday: 'Jue', Friday: 'Vie', Saturday: 'Sáb', Sunday: 'Dom',
}

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtDate(iso: string) {
  const d = new Date(iso)
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
  return `${DAY_LABELS[dayName] ?? dayName} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

function durationLabel(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function EventCard({ ev }: { ev: CalEvent }) {
  const isNow = (() => {
    const now = new Date()
    return new Date(ev.start) <= now && now <= new Date(ev.end)
  })()

  return (
    <div className={`relative flex gap-3 py-2.5 border-b border-white/[0.04] last:border-0 ${isNow ? 'opacity-100' : 'opacity-80 hover:opacity-100'} transition-opacity`}>
      {/* Time column */}
      <div className="flex-shrink-0 w-12 text-right">
        {ev.all_day
          ? <span className="text-[10px] text-slate-600">Todo el día</span>
          : <>
              <div className="text-[11px] font-medium text-slate-300">{ev.start_time}</div>
              <div className="text-[10px] text-slate-600">{ev.end_time}</div>
            </>
        }
      </div>

      {/* Color bar */}
      <div className={`w-0.5 rounded-full flex-shrink-0 ${isNow ? 'bg-primary shadow-[0_0_6px_rgba(124,58,237,0.6)]' : 'bg-white/10'}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-slate-200 truncate leading-snug">{ev.summary}</p>
          {isNow && (
            <span className="flex-shrink-0 badge badge-primary text-[9px] animate-pulse">En curso</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {ev.duration_min > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
              <Clock size={9} /> {durationLabel(ev.duration_min)}
            </span>
          )}
          {ev.location && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-600 truncate max-w-[120px]">
              <MapPin size={9} /> {ev.location}
            </span>
          )}
          {ev.attendee_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
              <Users size={9} /> {ev.attendee_count}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function CalendarWidget() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [todayCount, setTodayCount] = useState(0)
  const [weekCount, setWeekCount] = useState(0)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [todayRes, statsRes] = await Promise.all([
        api('/calendar/today'),
        api('/calendar/stats'),
      ])
      if (!todayRes.ok) throw new Error('No disponible')
      const todayData = await todayRes.json()
      const statsData = statsRes.ok ? await statsRes.json() : {}
      setEvents(todayData.events ?? [])
      setTodayCount(todayData.count ?? 0)
      setWeekCount(statsData.week_count ?? 0)
    } catch (e: any) {
      setError(e.message || 'Error al cargar calendario')
    } finally {
      setLoading(false)
    }
  }

  const today = new Date()
  const todayLabel = `${today.getDate()} ${MONTH_SHORT[today.getMonth()]}`

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Calendar size={13} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white leading-none">Calendario</h3>
            <p className="text-[10px] text-slate-600 mt-0.5">Outlook — {todayLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {weekCount > 0 && (
            <span className="badge badge-primary text-[10px]">{weekCount} esta semana</span>
          )}
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="space-y-3">
          {[0,1,2].map(i => (
            <div key={i} className="flex gap-3 py-2">
              <div className="skeleton w-12 h-8 rounded" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 rounded w-3/4" />
                <div className="skeleton h-2.5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 py-4 text-center justify-center">
          <AlertCircle size={14} className="text-slate-600" />
          <span className="text-xs text-slate-600">{error}</span>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="py-6 text-center">
          <Calendar size={24} className="text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-600">Sin eventos hoy</p>
          <p className="text-[10px] text-slate-700 mt-0.5">Tienes el día libre 🎉</p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="space-y-0">
          {events.slice(0, 5).map(ev => (
            <EventCard key={ev.uid || ev.start + ev.summary} ev={ev} />
          ))}
          {events.length > 5 && (
            <p className="text-[11px] text-slate-600 pt-2 text-center">
              +{events.length - 5} eventos más hoy
            </p>
          )}
        </div>
      )}
    </div>
  )
}