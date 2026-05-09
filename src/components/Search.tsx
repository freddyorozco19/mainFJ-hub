import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, X, MessageSquare, ScrollText, Loader2 } from 'lucide-react'
import { api } from '../api'

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
  error: 'text-red-400',
  warn: 'text-yellow-400',
  success: 'text-green-400',
  info: 'text-blue-400',
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await api(`/search?q=${encodeURIComponent(query)}`)
        if (r.ok) setResults(await r.json())
      } catch {}
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const go = (result: SearchResult) => {
    navigate(result.link)
    onClose()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) go(results[selected])
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <SearchIcon size={16} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            placeholder="Buscar en logs, mensajes..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={onKey}
          />
          {loading && <Loader2 size={14} className="animate-spin text-slate-500" />}
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-1">
            {results.map((r, i) => (
              <li key={r.type + r.id}>
                <button
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${i === selected ? 'bg-white/5' : ''}`}
                  onClick={() => go(r)}
                  onMouseEnter={() => setSelected(i)}
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
              </li>
            ))}
          </ul>
        )}

        {query && !loading && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-600">
            Sin resultados para "{query}"
          </div>
        )}

        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-slate-600">
          <span>↑↓ navegar</span>
          <span>↵ ir</span>
          <span>Esc cerrar</span>
        </div>
      </div>
    </div>
  )
}
