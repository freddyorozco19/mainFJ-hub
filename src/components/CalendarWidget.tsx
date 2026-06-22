import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Users, AlertCircle, X, ExternalLink, User, Video, Building2, Settings } from 'lucide-react'
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
  mentioned_contacts: { name: string | null; email: string }[]
}

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const SOURCE_STYLES = {
  outlook: { label: 'Outlook', dot: 'bg-blue-400',  text: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20'  },
  google:  { label: 'Google',  dot: 'bg-red-400',   text: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20'    },
} as const

const ATTENDEE_STATUS: Record<string, { label: string; color: string }> = {
  ACCEPTED:      { label: 'Acept',     color: 'text-emerald-400' },
  DECLINED:      { label: 'Rechaz',    color: 'text-red-400'     },
  TENTATIVE:     { label: 'Tentativo', color: 'text-amber-400'   },
  'NEEDS-ACTION':{ label: 'Pendiente', color: 'text-slate-500'   },
}

function durationLabel(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function meetingProvider(url: string) {
  if (url.includes('teams.microsoft') || url.includes('teams.live'))
    return { label: 'Microsoft Teams', color: 'bg-blue-600', hover: 'hover:bg-blue-500' }
  if (url.includes('zoom.us'))
    return { label: 'Zoom', color: 'bg-blue-500', hover: 'hover:bg-blue-400' }
  if (url.includes('meet.google'))
    return { label: 'Google Meet', color: 'bg-green-600', hover: 'hover:bg-green-500' }
  return { label: 'Unirse a reunión', color: 'bg-primary', hover: 'hover:bg-violet-500' }
}

function EventPopup({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  const isNow    = new Date(ev.start) <= new Date() && new Date() <= new Date(ev.end)
  const provider = ev.meeting_url ? meetingProvider(ev.meeting_url) : null
  const virtual  = !!ev.meeting_url
  const srcStyle = SOURCE_STYLES[ev.source]
  const organizer = ev.organizer_name || ev.organizer_email

  const cleanDesc = (() => {
    if (!ev.description) return null
    let d = ev.description
    if (virtual) {
      d = d.replace(/Microsoft Teams meeting[\s\S]*?(?=\n\n|$)/i, '')
      d = d.replace(/Join:.*?\n/gi, '')
      d = d.replace(/Meeting ID:.*?\n/gi, '')
      d = d.replace(/Passcode:.*?\n/gi, '')
      d = d.replace(/Need help\?.*?\n/gi, '')
      d = d.replace(/For organizers:.*?\n/gi, '')
    }
    return d.trim() || null
  })()

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-elevated shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-slide-up pointer-events-auto overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-5 pb-4 border-b border-white/[0.06]"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.07) 0%, transparent 60%)' }}>
            <button onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
              <X size={15} />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${srcStyle?.bg ?? 'bg-blue-500/10 border-blue-500/20'}`}>
                <Calendar size={16} className={srcStyle?.text ?? 'text-blue-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white leading-snug">{ev.summary}</h3>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${srcStyle?.bg ?? ''} ${srcStyle?.text ?? ''}`}>
                    {srcStyle?.label}
                  </span>
                  {virtual
                    ? <span className="flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md">
                        <Video size={9} /> Virtual
                      </span>
                    : <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                        <Building2 size={9} /> Presencial
                      </span>
                  }
                  {isNow && <span className="badge badge-primary text-[9px] animate-pulse">En curso</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-3.5 max-h-[65vh] overflow-y-auto">

            {/* Organizer / mentioned contacts */}
            {(organizer || (ev.mentioned_contacts && ev.mentioned_contacts.length > 0)) && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-600 uppercase tracking-wide">Contactos</p>
                {organizer && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 font-medium truncate">{ev.organizer_name ?? ev.organizer_email}</p>
                      {ev.organizer_name && ev.organizer_email && (
                        <p className="text-[10px] text-slate-600 truncate">{ev.organizer_email}</p>
                      )}
                    </div>
                  </div>
                )}
                {!organizer && ev.mentioned_contacts?.map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="w-7 h-7 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {c.name && <p className="text-xs text-slate-200 font-medium truncate">{c.name}</p>}
                      <p className={`text-[10px] text-slate-500 truncate ${!c.name ? 'text-xs text-slate-300' : ''}`}>{c.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-3">
              <Clock size={14} className="text-slate-500 flex-shrink-0" />
              <span className="text-sm text-slate-300">
                {ev.all_day
                  ? `Todo el día · ${ev.start_date}`
                  : <>{ev.start_time} – {ev.end_time} <span className="text-slate-500 ml-1">({durationLabel(ev.duration_min)})</span></>
                }
              </span>
            </div>

            {/* Location presencial */}
            {ev.location && !virtual && (
              <div className="flex items-start gap-3">
                <MapPin size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300">{ev.location}</span>
              </div>
            )}

            {/* Join button */}
            {ev.meeting_url && provider && (
              <a href={ev.meeting_url} target="_blank" rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all ${provider.color} ${provider.hover} hover:-translate-y-0.5`}
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                <Video size={15} />
                {provider.label}
                <ExternalLink size={12} className="opacity-70" />
              </a>
            )}

            {/* Attendees */}
            {ev.attendees.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users size={13} className="text-slate-500" />
                  <span className="text-xs text-slate-500">{ev.attendee_count} participante{ev.attendee_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-1.5 pl-5">
                  {ev.attendees.slice(0, 8).map((a, i) => {
                    const st = ATTENDEE_STATUS[a.status] ?? { label: a.status, color: 'text-slate-600' }
                    return (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400 truncate">{a.name}</span>
                        {a.status && <span className={`text-[10px] flex-shrink-0 ${st.color}`}>{st.label}</span>}
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
            {cleanDesc && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Descripción</span>
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                  {cleanDesc}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function EventCard({ ev, onClick }: { ev: CalEvent; onClick: () => void }) {
  const isNow  = new Date(ev.start) <= new Date() && new Date() <= new Date(ev.end)
  const srcDot = SOURCE_STYLES[ev.source]?.dot ?? 'bg-white/20'
  const virtual = !!ev.meeting_url

  return (
    <button onClick={onClick}
      className={`w-full text-left relative flex gap-3 py-2.5 border-b border-white/[0.04] last:border-0 transition-all duration-150 rounded-lg px-1 -mx-1 hover:bg-white/[0.03] ${isNow ? 'opacity-100' : 'opacity-75 hover:opacity-100'}`}>
      <div className="flex-shrink-0 w-12 text-right">
        {ev.all_day
          ? <span className="text-[10px] text-slate-600">Todo el día</span>
          : <>
              <div className="text-[11px] font-medium text-slate-300">{ev.start_time}</div>
              <div className="text-[10px] text-slate-600">{ev.end_time}</div>
            </>
        }
      </div>
      <div className={`w-0.5 rounded-full flex-shrink-0 ${isNow ? 'bg-primary shadow-[0_0_6px_rgba(124,58,237,0.6)]' : srcDot}`} />
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
          {virtual
            ? <span className="flex items-center gap-0.5 text-[10px] text-blue-500"><Video size={9} /> Virtual</span>
            : ev.location
              ? <span className="flex items-center gap-0.5 text-[10px] text-amber-500 truncate max-w-[110px]"><Building2 size={9} /> {ev.location}</span>
              : null
          }
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

export function CalendarWidget() {
  const [events, setEvents]     = useState<CalEvent[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [weekCount, setWeekCount] = useState(0)
  const [sources, setSources]   = useState<string[]>([])
  const [selected, setSelected] = useState<CalEvent | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [todayRes, statsRes] = await Promise.all([api('/calendar/today'), api('/calendar/stats')])
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
  const headerSrc = sources.length > 0
    ? sources.map(s => SOURCE_STYLES[s as keyof typeof SOURCE_STYLES]?.label).filter(Boolean).join(' + ')
    : 'Calendario'

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Calendar size={14} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-none">Calendario</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{todayLabel}</p>
            </div>
          </div>
          <span className="text-[10px] text-slate-600">{headerSrc}</span>
        </div>
        <div className="h-px bg-white/[0.05]" />

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
          <div className="flex items-center gap-2 py-4 justify-center">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs text-slate-400">{error}</span>
          </div>
        )}

        {!loading && !error && sources.length === 0 && (
          <div className="py-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center mx-auto">
              <Settings size={18} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-300 font-medium">Calendario no configurado</p>
            <p className="text-[11px] text-slate-500 leading-relaxed px-2">
              Agrega <span className="text-slate-300 font-mono">OUTLOOK_CALENDAR_ICS_URL</span> o{' '}
              <span className="text-slate-300 font-mono">GOOGLE_CALENDAR_ICS_URL</span> en las vars de entorno de Render.
            </p>
          </div>
        )}

        {!loading && !error && sources.length > 0 && events.length === 0 && (
          <div className="py-6 text-center">
            <Calendar size={24} className="text-slate-500 mx-auto mb-2" />
            <p className="text-xs text-slate-300">Sin eventos hoy</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Tienes el día libre</p>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div>
            {events.slice(0, 5).map(ev => (
              <EventCard key={ev.uid || ev.start + ev.summary} ev={ev} onClick={() => setSelected(ev)} />
            ))}
            {events.length > 5 && (
              <p className="text-[11px] text-slate-600 pt-2 text-center">
                +{events.length - 5} eventos mas hoy
              </p>
            )}
          </div>
        )}
      </div>

      {selected && <EventPopup ev={selected} onClose={() => setSelected(null)} />}
    </>
  )
}