import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Users, AlertCircle, X, ExternalLink, User, Video } from 'lucide-react'
import { api } from '../api'

interface Attendee {
  name: string
  status: string
}

interface CalEvent {
  uid: string
  source: 'outlook' | 'google'
  summary: string
  start: string
  end: string
  start_date: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  duration_min: number
  location: string | null
  description: string | null
  meeting_url: string | null
  organizer_name: string | null
  organizer_email: string | null
  attendees: Attendee[]
  attendee_count: number
}

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const SOURCE_STYLES = {
  outlook: { label: 'Outlook', dot: 'bg-blue-400',   text: 'text-blue-400'  },
  google:  { label: 'Google',  dot: 'bg-red-400',    text: 'text-red-400'   },
} as const

const ATTENDEE_STATUS: Record<string, { label: string; color: string }> = {
  ACCEPTED:     { label: 'Aceptó',   color: 'text-emerald-400' },
  DECLINED:     { label: 'Rechazó',  color: 'text-red-400'     },
  TENTATIVE:    { label: 'Tentativo',color: 'text-amber-400'   },
  'NEEDS-ACTION':{ label: 'Pendiente',color: 'text-slate-500'  },
}

function durationLabel(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function meetingProvider(url: string) {
  if (url.includes('teams.microsoft') || url.includes('teams.live')) return { label: 'Microsoft Teams', color: 'bg-blue-600' }
  if (url.includes('zoom.us')) return { label: 'Zoom', color: 'bg-blue-500' }
  if (url.includes('meet.google')) return { label: 'Google Meet', color: 'bg-green-600' }
  return { label: 'Unirse a reunión', color: 'bg-primary' }
}

/* ── Event Detail Popup ─────────────────────────────────────── */
function EventPopup({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  const isNow = new Date(ev.start) <= new Date() && new Date() <= new Date(ev.end)
  const provider = ev.meeting_url ? meetingProvider(ev.meeting_url) : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-elevated shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-slide-up pointer-events-auto overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-5 pb-4 border-b border-white/[0.06]"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, transparent 60%)' }}>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X size={15} />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Calendar size={16} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white leading-snug">{ev.summary}</h3>
                <span className={`flex-shrink-0 text-[9px] font-medium ${SOURCE_STYLES[ev.source]?.text ?? 'text-slate-500'}`}>
                  {SOURCE_STYLES[ev.source]?.label}
                </span>
                {isNow && (
                  <span className="inline-flex mt-1 badge badge-primary text-[9px] animate-pulse">En curso ahora</span>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">

            {/* Date & time */}
            <div className="flex items-center gap-3">
              <Clock size={14} className="text-slate-500 flex-shrink-0" />
              <div className="text-sm text-slate-300">
                {ev.all_day
                  ? <span>Todo el día · {ev.start_date}</span>
                  : <span>
                      {ev.start_time} – {ev.end_time}
                      <span className="text-slate-500 ml-2">({durationLabel(ev.duration_min)})</span>
                    </span>
                }
              </div>
            </div>

            {/* Location */}
            {ev.location && !ev.meeting_url && (
              <div className="flex items-start gap-3">
                <MapPin size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300">{ev.location}</span>
              </div>
            )}

            {/* Meeting join button */}
            {ev.meeting_url && provider && (
              <a
                href={ev.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 hover:-translate-y-0.5 ${provider.color}`}
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
              >
                <Video size={15} />
                {provider.label}
                <ExternalLink size={12} className="opacity-70" />
              </a>
            )}

            {/* Organizer */}
            {ev.organizer_name && (
              <div className="flex items-center gap-3">
                <User size={14} className="text-slate-500 flex-shrink-0" />
                <div className="text-sm text-slate-300">
                  <span className="text-slate-500 text-xs mr-1">Organiza:</span>
                  {ev.organizer_name}
                  {ev.organizer_email && (
                    <span className="text-slate-600 text-xs ml-1">· {ev.organizer_email}</span>
                  )}
                </div>
              </div>
            )}

            {/* Attendees */}
            {ev.attendees.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-500" />
                  <span className="text-xs text-slate-500">{ev.attendee_count} participantes</span>
                </div>
                <div className="space-y-1.5 pl-5">
                  {ev.attendees.slice(0, 8).map((a, i) => {
                    const st = ATTENDEE_STATUS[a.status] ?? { label: a.status, color: 'text-slate-500' }
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 truncate max-w-[260px]">{a.name}</span>
                        {a.status && (
                          <span className={`text-[10px] ${st.color} flex-shrink-0 ml-2`}>{st.label}</span>
                        )}
                      </div>
                    )
                  })}
                  {ev.attendee_count > 8 && (
                    <span className="text-[10px] text-slate-600">+{ev.attendee_count - 8} más</span>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {ev.description && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Descripción</span>
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                  {ev.description}
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}

/* ── Event Card ─────────────────────────────────────────────── */
function EventCard({ ev, onClick }: { ev: CalEvent; onClick: () => void }) {
  const isNow = new Date(ev.start) <= new Date() && new Date() <= new Date(ev.end)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left relative flex gap-3 py-2.5 border-b border-white/[0.04] last:border-0 transition-all duration-150 rounded-lg px-1 -mx-1 hover:bg-white/[0.03] ${isNow ? 'opacity-100' : 'opacity-75 hover:opacity-100'}`}
    >
      {/* Time */}
      <div className="flex-shrink-0 w-12 text-right">
        {ev.all_day
          ? <span className="text-[10px] text-slate-600">Todo el día</span>
          : <>
              <div className="text-[11px] font-medium text-slate-300">{ev.start_time}</div>
              <div className="text-[10px] text-slate-600">{ev.end_time}</div>
            </>
        }
      </div>

      {/* Source dot + bar */}
      <div className={`w-0.5 rounded-full flex-shrink-0 ${isNow ? 'bg-primary shadow-[0_0_6px_rgba(124,58,237,0.6)]' : 'bg-white/10'}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-slate-200 truncate leading-snug">{ev.summary}</p>
          {isNow && <span className="flex-shrink-0 badge badge-primary text-[9px] animate-pulse">En curso</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {ev.duration_min > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
              <Clock size={9} /> {durationLabel(ev.duration_min)}
            </span>
          )}
          {ev.meeting_url && (
            <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
              <Video size={9} /> Online
            </span>
          )}
          {ev.location && !ev.meeting_url && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-600 truncate max-w-[110px]">
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
    </button>
  )
}

/* ── Calendar Widget ────────────────────────────────────────── */
export function CalendarWidget() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weekCount, setWeekCount] = useState(0)
  const [sources, setSources] = useState<string[]>([])
  const [selected, setSelected] = useState<CalEvent | null>(null)

  useEffect(() => { load() }, [])

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
      setWeekCount(statsData.week_count ?? 0)
      setSources(statsData.sources ?? [])
    } catch (e: any) {
      setError(e.message || 'Error al cargar calendario')
    } finally {
      setLoading(false)
    }
  }

  const today = new Date()
  const todayLabel = `${today.getDate()} ${MONTH_SHORT[today.getMonth()]}`

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Calendar size={13} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-none">Calendario</h3>
              <p className="text-[10px] text-slate-600 mt-0.5">{sources.length > 0 ? sources.map(s => SOURCE_STYLES[s as keyof typeof SOURCE_STYLES]?.label).join(' + ') : 'Calendario'} — {todayLabel}</p>
            </div>
          </div>
          {weekCount > 0 && (
            <span className="badge badge-primary text-[10px]">{weekCount} esta semana</span>
          )}
        </div>

        {/* Loading */}
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

        {/* Error */}
        {!loading && error && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <AlertCircle size={14} className="text-slate-600" />
            <span className="text-xs text-slate-600">{error}</span>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && events.length === 0 && (
          <div className="py-6 text-center">
            <Calendar size={24} className="text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-600">Sin eventos hoy</p>
            <p className="text-[10px] text-slate-700 mt-0.5">Tienes el día libre 🎉</p>
          </div>
        )}

        {/* Events list */}
        {!loading && !error && events.length > 0 && (
          <div>
            {events.slice(0, 5).map(ev => (
              <EventCard key={ev.uid || ev.start + ev.summary} ev={ev} onClick={() => setSelected(ev)} />
            ))}
            {events.length > 5 && (
              <p className="text-[11px] text-slate-600 pt-2 text-center">
                +{events.length - 5} eventos más hoy
              </p>
            )}
          </div>
        )}
      </div>

      {/* Popup */}
      {selected && <EventPopup ev={selected} onClose={() => setSelected(null)} />}
    </>
  )
}