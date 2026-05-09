import { useState, useEffect } from 'react'
import { Webhook, Copy, Check, RefreshCw, Zap, Clock } from 'lucide-react'
import { api } from '../api'

interface WebhookEvent {
  id: number
  source: string
  event_type: string
  payload: string | null
  received_at: string
}

interface WebhookConfig {
  webhook_url: string
  header_name: string
  secret_hint: string
  example_body: object
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="p-1.5 text-slate-500 hover:text-white transition-colors">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

export function Webhooks() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [config, setConfig] = useState<WebhookConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [evRes, cfgRes] = await Promise.all([
        api('/webhooks/events'),
        api('/webhooks/config'),
      ])
      if (evRes.ok)  setEvents(await evRes.json())
      if (cfgRes.ok) setConfig(await cfgRes.json())
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Webhook size={20} className="text-primary" /> Webhooks
          </h1>
          <p className="text-sm text-slate-500 mt-1">Recibe eventos externos en tiempo real</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Config */}
      {config && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Configuración</h2>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">URL del Webhook (POST)</p>
              <div className="flex items-center gap-2 bg-black/30 border border-border rounded-lg px-3 py-2">
                <code className="flex-1 text-xs text-primary break-all">{config.webhook_url}</code>
                <CopyButton text={config.webhook_url} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Header requerido</p>
                <div className="flex items-center gap-2 bg-black/30 border border-border rounded-lg px-3 py-2">
                  <code className="flex-1 text-xs text-yellow-400">{config.header_name}</code>
                  <CopyButton text={config.header_name} />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Secret</p>
                <div className="flex items-center gap-2 bg-black/30 border border-border rounded-lg px-3 py-2">
                  <code className="flex-1 text-xs text-slate-400 italic">{config.secret_hint}</code>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Ejemplo de body (JSON)</p>
              <div className="flex items-start gap-2 bg-black/30 border border-border rounded-lg px-3 py-2">
                <code className="flex-1 text-xs text-green-400 whitespace-pre">
                  {JSON.stringify(config.example_body, null, 2)}
                </code>
                <CopyButton text={JSON.stringify(config.example_body, null, 2)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Eventos recibidos</h2>
          <span className="text-xs text-slate-500">{events.length} eventos</span>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <RefreshCw size={14} className="animate-spin" /> Cargando...
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-sm">
            <Zap size={32} className="mx-auto mb-3 opacity-20" />
            <p>Sin eventos aún</p>
            <p className="text-xs mt-1">Envía un POST a la URL de arriba para ver eventos aquí</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 p-3 bg-black/20 border border-border/50 rounded-lg">
                <Zap size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{ev.event_type}</span>
                    <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{ev.source}</span>
                  </div>
                  {ev.payload && (
                    <pre className="text-xs text-slate-400 mt-1 truncate max-w-full overflow-hidden">
                      {ev.payload}
                    </pre>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-600 flex-shrink-0">
                  <Clock size={10} />
                  {new Date(ev.received_at).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
