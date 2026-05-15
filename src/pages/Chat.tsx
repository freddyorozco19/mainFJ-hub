import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, ChevronDown, Paperclip, X, File, Upload, Loader2, Cpu, DollarSign } from 'lucide-react'
import { useDashboard } from '../store/dashboardStore'
import type { ChatMessage } from '../store/dashboardStore'
import { api } from '../api'

interface AttachedFile {
  id: string
  name: string
  size: number
  type: string
  file: File
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Markdown renderer (sin dependencias externas) ─────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g
  const parts = text.split(re)
  return parts.map((part, i) => {
    if (/^\*\*[^*\n]+\*\*$/.test(part))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
    if (/^\*[^*\n]+\*$/.test(part) && part.length > 2)
      return <em key={i} className="italic text-slate-300">{part.slice(1, -1)}</em>
    if (/^`[^`\n]+`$/.test(part))
      return <code key={i} className="bg-black/40 text-amber-300 px-1 py-0.5 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>
    const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (lm)
      return <a key={i} href={lm[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{lm[1]}</a>
    return part
  })
}

function MdLine({ line }: { line: string }) {
  const h3 = line.match(/^### (.+)/); if (h3) return <h3 className="text-sm font-bold text-white mt-3 mb-1">{renderInline(h3[1])}</h3>
  const h2 = line.match(/^## (.+)/);  if (h2) return <h2 className="text-base font-bold text-white mt-3 mb-1">{renderInline(h2[1])}</h2>
  const h1 = line.match(/^# (.+)/);   if (h1) return <h1 className="text-lg font-bold text-white mt-3 mb-1">{renderInline(h1[1])}</h1>
  const ul = line.match(/^[-*] (.+)/); if (ul) return <li className="text-sm text-slate-200 ml-4 list-disc">{renderInline(ul[1])}</li>
  const ol = line.match(/^\d+\. (.+)/); if (ol) return <li className="text-sm text-slate-200 ml-4 list-decimal">{renderInline(ol[1])}</li>
  if (line.trim() === '') return <div className="h-1.5" />
  return <p className="text-sm text-slate-200 leading-relaxed">{renderInline(line)}</p>
}

function MarkdownContent({ content }: { content: string }) {
  const segments: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = []
  const cbRe = /```(\w*)\n?([\s\S]*?)```/g
  let lastIdx = 0; let m: RegExpExecArray | null
  while ((m = cbRe.exec(content)) !== null) {
    if (m.index > lastIdx) segments.push({ type: 'text', content: content.slice(lastIdx, m.index) })
    segments.push({ type: 'code', content: m[2], lang: m[1] || '' })
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < content.length) segments.push({ type: 'text', content: content.slice(lastIdx) })

  return (
    <div className="space-y-0.5">
      {segments.map((seg, si) =>
        seg.type === 'code' ? (
          <div key={si} className="rounded-lg overflow-hidden my-2 border border-white/10">
            {seg.lang && <div className="bg-black/60 px-3 py-1 text-[10px] text-slate-500 font-mono border-b border-white/10">{seg.lang}</div>}
            <pre className="bg-black/40 p-3 overflow-x-auto text-xs font-mono text-green-300 leading-relaxed">
              <code>{seg.content.trim()}</code>
            </pre>
          </div>
        ) : (
          <div key={si}>{seg.content.split('\n').map((line, li) => <MdLine key={li} line={line} />)}</div>
        )
      )}
    </div>
  )
}

// ── Message ───────────────────────────────────────────────────────────────

function Message({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
        isUser ? 'bg-primary/20 text-primary' : 'bg-card border border-border text-slate-400'
      }`}>
        {isUser ? 'FJ' : <Bot size={13} />}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-primary text-white rounded-tr-sm'
          : 'bg-card border border-border text-slate-200 rounded-tl-sm'
      }`}>
        {isUser
          ? <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
          : <MarkdownContent content={msg.content} />
        }
        <div className={`text-[10px] mt-1.5 ${isUser ? 'text-primary/60' : 'text-slate-600'}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {msg.tokens ? <span className="ml-2">{msg.tokens} tok</span> : null}
        </div>
      </div>
    </div>
  )
}

// ── Chat page ─────────────────────────────────────────────────────────────

export function Chat() {
  const { agents, activeAgentSlug, chatHistories, isTyping, setActiveAgent, addMessage, setHistory, setTyping } = useDashboard()
  const [input, setInput] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const enabledAgents = agents.filter(a => a.enabled)
  const activeAgent   = agents.find(a => a.slug === activeAgentSlug)
  const messages      = activeAgentSlug ? (chatHistories[activeAgentSlug] ?? []) : []
  const sessionCost   = messages.reduce((acc, m) => acc + (m.tokens ? m.tokens * 0.000004 : 0), 0)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])

  useEffect(() => {
    if (!activeAgentSlug) return
    if ((chatHistories[activeAgentSlug] ?? []).length > 0) return
    setLoadingHistory(true)
    api(`/chat/${activeAgentSlug}/history`)
      .then(r => r.json())
      .then((data: ChatMessage[]) => { if (data.length > 0) setHistory(activeAgentSlug, data) })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [activeAgentSlug])

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newFiles: AttachedFile[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, file,
    }))
    setAttachedFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false)
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const send = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || !activeAgentSlug) return
    const text = input.trim()
    setInput('')
    addMessage({ id: crypto.randomUUID(), role: 'user', content: text || `[Archivos: ${attachedFiles.map(f => f.name).join(', ')}]`, agentSlug: activeAgentSlug, timestamp: new Date().toISOString() })
    setTyping(true)
    try {
      await api(`/chat/${activeAgentSlug}`, { method: 'POST', body: { text } })
      setAttachedFiles([])
    } catch {
      addMessage({ id: crypto.randomUUID(), role: 'assistant', content: 'No se pudo conectar al backend. Asegurate de que el servidor esté corriendo.', agentSlug: activeAgentSlug, timestamp: new Date().toISOString() })
      setTyping(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface/50 flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl text-sm hover:border-primary/40 transition-colors"
          >
            <span className="text-base leading-none">{activeAgent?.icon ?? '🤖'}</span>
            <span className="font-medium text-white">{activeAgent?.name ?? 'Seleccionar agente'}</span>
            <ChevronDown size={13} className="text-slate-500" />
          </button>
          {showPicker && (
            <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-2xl z-50 min-w-52 py-1">
              {enabledAgents.length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-500">Activa agentes en la pestaña Agentes</div>
              )}
              {enabledAgents.map(a => (
                <button key={a.slug} onClick={() => { setActiveAgent(a.slug); setShowPicker(false) }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left ${a.slug === activeAgentSlug ? 'text-primary' : 'text-slate-300'}`}>
                  <span>{a.icon}</span><span>{a.name}</span>
                  <span className="ml-auto text-[10px] text-slate-600">{a.model.split('/').pop()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {activeAgent && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="hidden sm:flex items-center gap-1"><Cpu size={11} />{activeAgent.model.split('/').pop()}</span>
            {sessionCost > 0 && <span className="hidden sm:flex items-center gap-1"><DollarSign size={11} />${sessionCost.toFixed(5)}</span>}
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={dropZoneRef}
        className={`flex-1 overflow-y-auto px-6 py-6 space-y-5 transition-colors relative ${isDragging ? 'bg-primary/5' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload size={40} />
              <span className="text-sm font-medium">Suelta los archivos aquí</span>
            </div>
          </div>
        )}

        {!activeAgentSlug && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
            <Bot size={48} className="opacity-20" />
            <p className="text-sm">Selecciona un agente para empezar a chatear</p>
          </div>
        )}

        {activeAgentSlug && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
            {loadingHistory
              ? <Loader2 size={24} className="animate-spin text-slate-500" />
              : <><span className="text-4xl">{activeAgent?.icon}</span>
                  <p className="text-sm font-medium text-slate-400">{activeAgent?.name}</p>
                  <p className="text-xs text-slate-600">¿En qué te puedo ayudar?</p>
                  <p className="text-xs text-slate-700 mt-2">Arrastra archivos aquí para adjuntarlos</p></>
            }
          </div>
        )}

        {messages.map(msg => <Message key={msg.id} msg={msg} />)}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center">
              <Bot size={13} className="text-slate-400" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div className="px-6 py-2 border-t border-border bg-surface/30 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map(f => (
              <div key={f.id} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                <File size={12} className="text-primary" />
                <span className="text-xs text-slate-300 max-w-32 truncate">{f.name}</span>
                <span className="text-[10px] text-slate-600">{formatFileSize(f.size)}</span>
                <button onClick={() => setAttachedFiles(prev => prev.filter(a => a.id !== f.id))} className="text-slate-500 hover:text-danger transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-border flex-shrink-0">
        <div className="flex gap-3 items-end bg-card border border-border rounded-2xl px-4 py-3 focus-within:border-primary/40 transition-colors">
          <label className="cursor-pointer text-slate-500 hover:text-primary transition-colors p-1">
            <Paperclip size={16} />
            <input type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} disabled={!activeAgentSlug} />
          </label>
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 resize-none outline-none max-h-32"
            placeholder={activeAgentSlug ? `Escribe a ${activeAgent?.name}…` : 'Selecciona un agente primero…'}
            value={input}
            disabled={!activeAgentSlug}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button
            onClick={send}
            disabled={(!input.trim() && attachedFiles.length === 0) || !activeAgentSlug || isTyping}
            className="p-1.5 rounded-lg bg-primary hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-slate-700 mt-1.5 text-center">Enter para enviar · Shift+Enter para nueva línea · Arrastra archivos</p>
      </div>
    </div>
  )
}