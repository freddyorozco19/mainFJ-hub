import { useState, useEffect } from 'react'
import { Mail, AlertCircle, RefreshCw } from 'lucide-react'
import { api } from '../api'

interface InboxEmail {
  uid: string
  source: 'gmail' | 'outlook'
  subject: string
  sender_name: string | null
  sender_email: string | null
  date: string | null
  date_label: string | null
  snippet: string | null
  unread: boolean
}

const SOURCE_STYLES = {
  gmail:   { label: 'Gmail',   dot: 'bg-red-400',  text: 'text-red-400',  bg: 'bg-red-500/10 border-red-500/20'   },
  outlook: { label: 'Outlook', dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
} as const

interface EmailPopupProps {
  email: InboxEmail
  onClose: () => void
}

function EmailPopup({ email: em, onClose }: EmailPopupProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-elevated shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-slide-up pointer-events-auto overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="relative p-5 pb-4 border-b border-white/[0.06]"
            style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.07) 0%, transparent 60%)' }}>
            <button onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
              ✕
            </button>
            <div className="flex items-start gap-3 pr-8">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Mail size={16} className="text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white leading-snug">{em.subject}</h3>
                {em.unread && <span className="inline-flex mt-1 badge badge-primary text-[9px]">No leído</span>}
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <div className="w-8 h-8 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-400">
                {(em.sender_name ?? em.sender_email ?? '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-600 uppercase tracking-wide">De</p>
                {em.sender_name && <p className="text-sm text-slate-200 font-medium truncate">{em.sender_name}</p>}
                {em.sender_email && <p className="text-[10px] text-slate-500 truncate">{em.sender_email}</p>}
              </div>
              {em.date_label && <span className="text-[10px] text-slate-600 flex-shrink-0">{em.date_label}</span>}
            </div>

            {em.snippet && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">Vista previa</p>
                <p className="text-xs text-slate-400 leading-relaxed rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                  {em.snippet}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function EmailRow({ em, onClick }: { em: InboxEmail; onClick: () => void }) {
  const initials = (em.sender_name ?? em.sender_email ?? '?')[0].toUpperCase()
  return (
    <button onClick={onClick}
      className={`w-full text-left flex items-start gap-3 py-2.5 px-1 -mx-1 border-b border-white/[0.04] last:border-0 rounded-lg hover:bg-white/[0.03] transition-all ${em.unread ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
      {/* Avatar */}
      <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-cyan-400 mt-0.5">
        {initials}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs truncate ${em.unread ? 'font-semibold text-slate-200' : 'font-normal text-slate-400'}`}>
            {em.sender_name ?? em.sender_email ?? 'Desconocido'}
          </p>
          <span className="text-[10px] text-slate-600 flex-shrink-0">{em.date_label}</span>
        </div>
        <p className={`text-[11px] truncate mt-0.5 ${em.unread ? 'text-slate-300' : 'text-slate-500'}`}>
          {em.subject}
        </p>
        {em.snippet && (
          <p className="text-[10px] text-slate-600 truncate mt-0.5">{em.snippet}</p>
        )}
      </div>
      {/* Source + unread */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md border ${SOURCE_STYLES[em.source]?.bg ?? ''} ${SOURCE_STYLES[em.source]?.text ?? ''}`}>
          {SOURCE_STYLES[em.source]?.label ?? em.source}
        </span>
        {em.unread && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
      </div>
    </button>
  )
}

export function EmailWidget() {
  const [emails, setEmails]     = useState<InboxEmail[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [unread, setUnread]     = useState(0)
  const [selected, setSelected] = useState<InboxEmail | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [])

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await api('/inbox/emails?limit=10')
      if (!res.ok) throw new Error('No disponible')
      const data = await res.json()
      setEmails(data.emails ?? [])
      setUnread(data.unread ?? 0)
    } catch (e: any) {
      setError(e.message || 'Error al cargar correos')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Mail size={13} className="text-cyan-400" />
              </div>
              {unread > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-none">Correos</h3>
              <p className="text-[10px] text-slate-600 mt-0.5">Gmail + Outlook</p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            className={`p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.05] transition-colors ${refreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="h-px bg-white/[0.05]" />

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="flex gap-3 py-2">
                <div className="skeleton w-7 h-7 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 rounded w-1/3" />
                  <div className="skeleton h-2.5 rounded w-2/3" />
                  <div className="skeleton h-2 rounded w-full" />
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
        {!loading && !error && emails.length === 0 && (
          <div className="py-6 text-center">
            <Mail size={24} className="text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-600">Sin correos recientes</p>
          </div>
        )}

        {/* Email list */}
        {!loading && !error && emails.length > 0 && (
          <div>
            {emails.slice(0, 8).map(em => (
              <EmailRow key={em.uid} em={em} onClick={() => setSelected(em)} />
            ))}
            {emails.length > 8 && (
              <p className="text-[11px] text-slate-600 pt-2 text-center">
                +{emails.length - 8} correos mas
              </p>
            )}
          </div>
        )}
      </div>

      {selected && <EmailPopup email={selected} onClose={() => setSelected(null)} />}
    </>
  )
}