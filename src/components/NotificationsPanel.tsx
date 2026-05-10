import { useState, useRef, useEffect } from 'react'
import { Bell, X, CheckCircle, AlertTriangle, Info, AlertCircle, Trash2 } from 'lucide-react'
import { useDashboard } from '../store/dashboardStore'

const ICONS = {
  info:    Info,
  success: CheckCircle,
  warn:    AlertTriangle,
  error:   AlertCircle,
}

const COLORS = {
  info:    'text-accent',
  success: 'text-success',
  warn:    'text-warning',
  error:   'text-danger',
}

export function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, markAllRead, clearNotifications } = useDashboard()
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = () => {
    setOpen(v => !v)
    if (!open && unread > 0) setTimeout(markAllRead, 1500)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        title="Notificaciones"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-white">Notificaciones</span>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-slate-500 hover:text-danger transition-colors"
                  title="Limpiar todo"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-600 text-sm">
                <Bell size={24} className="mx-auto mb-2 opacity-20" />
                Sin notificaciones
              </div>
            ) : (
              notifications.map(n => {
                const Icon = ICONS[n.type]
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${n.read ? 'opacity-50' : 'bg-white/2'}`}
                  >
                    <Icon size={14} className={`mt-0.5 flex-shrink-0 ${COLORS[n.type]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {new Date(n.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
