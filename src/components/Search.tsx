import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, MessageSquare, ScrollText, Loader2,
  Home, Bot, Wallet, BarChart3, Layers, Activity, Trophy, Brain,
  TrendingUp, Heart, Network, Webhook, User, Command,
} from 'lucide-react'
import { api } from '../api'
import { useDashboard } from '../store/dashboardStore'

const PAGES = [
  { to: '/home',     label: 'Home',        icon: Home,       section: 'nav' },
  { to: '/chat',     label: 'Chat',        icon: MessageSquare, section: 'nav' },
  { to: '/finance',  label: 'Finanzas',    icon: Wallet,     section: 'nav' },
  { to: '/agents',   label: 'Agentes',     icon: Bot,        section: 'nav' },
  { to: '/metrics',  label: 'Metricas',    icon: BarChart3,  section: 'nav' },
  { to: '/logs',     label: 'Logs',        icon: ScrollText, section: 'nav' },
  { to: '/backlog',  label: 'Backlog',     icon: Layers,     section: 'nav' },
  { to: '/health',   label: 'Health',      icon: Activity,   section: 'nav' },
  { to: '/winstats', label: 'WinStats',    icon: Trophy,     section: 'nav' },
  { to: '/expertia', label: 'ArchiTechIA', icon: Brain,      section: 'nav' },
  { to: '/growdata', label: 'Grow Data',   icon: TrendingUp, section: 'nav' },
  { to: '/life',     label: 'LIFE',        icon: Heart,      section: 'nav' },
  { to: '/kronos',   label: 'KRONOS',      icon: Network,    section: 'nav' },
  { to: '/webhooks', label: 'Webhooks',    icon: Webhook,    section: 'nav' },
  { to: '/profile',  label: 'Perfil',      icon: User,       section: 'nav' },
]

interface SearchResult {
  type: 'log' | 'message'
  id: string
  title: string
  subtitle: string
  meta: string
  timestamp: string
  level?: string
  link: string
}

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

const LEVEL_COLORS: Record<string, string> = {
  error: 'text-red-400', warn: 'text-yellow-400', success: 'text-green-400', info: 'text-blue-400',
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { agents, setActiveAgent } = useDashboard()

  const enabledAgents = agents.filter(a => a.enabled)

  const filteredPages = query
    ? PAGES.filter(p => p.label.toLowerCase().includes(query.toLowerCase()))
    : PAGES

  const filteredAgents = query
    ? enabledAgents.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
    : enabledAgents

  const totalQuick = filteredPages.length + filteredAgents.length
  const allItems = [
    ...filteredPages.map((p, i) => ({ ...p, _type: 'page' as const, _idx: i })),
    ...filteredAgents.map((a, i) => ({ to: '/chat', label: a.name, icon: Bot, section: 'agent', slug: a.slug, _type: 'agent' as const, _idx: filteredPages.length + i })),
    ...results.map((r, i) => ({ ...r, to: r.link, _type: 'result' as const, _idx: totalQuick + i })),
  ]

  useEffect(() => {
    if (open) { setQuery(''); setResults([]); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try { const r = await api('/search?q=' + encodeURIComponent(query)); if (r.ok) setResults(await r.json()) }
      catch {} finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const go = (item: typeof allItems[0]) => {
    if (item._type === 'agent' && 'slug' in item) {
      setActiveAgent((item as any).slug)
      navigate('/chat')
    } else {
      navigate(item.to)
    }
    onClose()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && allItems[selected]) go(allItems[selected])
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
      <div
        className="relative w-full max-w-xl bg-surface/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <Command size={15} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            placeholder="Buscar paginas, agentes, mensajes..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={onKey}
          />
          {loading && <Loader2 size={14} className="animate-spin text-slate-500" />}
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredPages.length > 0 && (
            <>
              <div className="px-4 py-2 text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Paginas</div>
              {filteredPages.map((p, i) => {
                const Icon = p.icon
                const idx = i
                return (
                  <button
                    key={p.to}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${idx === selected ? 'bg-white/5' : ''}`}
                    onClick={() => go({ ...p, _type: 'page', _idx: idx })}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-border flex items-center justify-center flex-shrink-0">
                      <Icon size={13} className="text-slate-400" />
                    </div>
                    <span className="text-sm text-slate-200">{p.label}</span>
                    <span className="ml-auto text-[10px] text-slate-600">{p.to}</span>
                  </button>
                )
              })}
            </>
          )}

          {filteredAgents.length > 0 && (
            <>
              <div className="px-4 py-2 text-[10px] text-slate-600 uppercase tracking-widest font-semibold border-t border-border/50">Cambiar agente</div>
              {filteredAgents.map((a, i) => {
                const idx = filteredPages.length + i
                return (
                  <button
                    key={a.slug}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${idx === selected ? 'bg-white/5' : ''}`}
                    onClick={() => go({ to: '/chat', label: a.name, icon: Bot, section: 'agent', _type: 'agent', _idx: idx, slug: a.slug } as any)}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <span className="w-7 h-7 flex items-center justify-center text-lg flex-shrink-0">{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">{a.name}</p>
                      <p className="text-[10px] text-slate-600">{a.model.split('/').pop()}</p>
                    </div>
                    <span className="text-[10px] text-primary">Usar</span>
                  </button>
                )
              })}
            </>
          )}

          {results.length > 0 && (
            <>
              <div className="px-4 py-2 text-[10px] text-slate-600 uppercase tracking-widest font-semibold border-t border-border/50">Resultados</div>
              {results.map((r, i) => {
                const idx = totalQuick + i
                return (
                  <button
                    key={r.type + r.id}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${idx === selected ? 'bg-white/5' : ''}`}
                    onClick={() => go({ ...r, icon: Bot, section: 'result', to: r.link, _type: 'result', _idx: idx } as any)}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {r.type === 'message'
                        ? <MessageSquare size={14} className="text-primary" />
                        : <ScrollText size={14} className={LEVEL_COLORS[r.level ?? 'info']} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{r.title}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{r.subtitle}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 flex-shrink-0 mt-1">
                      {new Date(r.timestamp).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                    </span>
                  </button>
                )
              })}
            </>
          )}

          {query && !loading && results.length === 0 && filteredPages.length === 0 && filteredAgents.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-600">Sin resultados para "{query}"</div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/8 flex items-center gap-4 text-[10px] text-slate-600 bg-white/[0.02]">
          <span>↑↓ navegar</span>
          <span>↵ ir</span>
          <span>Esc cerrar</span>
          <span className="ml-auto">{allItems.length} resultado{allItems.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}
