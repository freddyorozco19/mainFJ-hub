import { useState, useRef, useEffect } from 'react'
import { Send, Bot, ChevronDown } from 'lucide-react'
import { useDashboard } from '../store/dashboardStore'
import type { ChatMessage } from '../store/dashboardStore'

const API = 'http://localhost:8001'

function Message({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
        isUser ? 'bg-primary/20 text-primary' : 'bg-card border border-border text-slate-400'
      }`}>
        {isUser ? 'FJ' : <Bot size={13} />}
      </div>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-primary text-white rounded-tr-sm'
          : 'bg-card border border-border text-slate-200 rounded-tl-sm'
      }`}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        <div className={`text-[10px] mt-1 ${isUser ? 'text-primary/60' : 'text-slate-600'}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {msg.tokens && <span className="ml-2">{msg.tokens} tok</span>}
        </div>
      </div>
    </div>
  )
}

export function Chat() {
  const { agents, activeAgentSlug, chatHistories, isTyping, setActiveAgent, addMessage, setTyping } = useDashboard()
  const [input, setInput] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const enabledAgents = agents.filter(a => a.enabled)
  const activeAgent   = agents.find(a => a.slug === activeAgentSlug)
  const messages      = activeAgentSlug ? (chatHistories[activeAgentSlug] ?? []) : []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const send = async () => {
    if (!input.trim() || !activeAgentSlug) return
    const text = input.trim()
    setInput('')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      agentSlug: activeAgentSlug,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMsg)
    setTyping(true)

    try {
      const res = await fetch(`${API}/chat/${activeAgentSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json() as { text: string; output_tokens: number }
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text,
        agentSlug: activeAgentSlug,
        timestamp: new Date().toISOString(),
        tokens: data.output_tokens,
      })
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '⚠️ No se pudo conectar al backend. Asegúrate de que el servidor esté corriendo en :8001',
        agentSlug: activeAgentSlug,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setTyping(false)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-surface/50">
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
                <div className="px-4 py-3 text-xs text-slate-500">
                  Activa agentes en la pestaña Agentes
                </div>
              )}
              {enabledAgents.map(a => (
                <button
                  key={a.slug}
                  onClick={() => { setActiveAgent(a.slug); setShowPicker(false) }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left ${
                    a.slug === activeAgentSlug ? 'text-primary' : 'text-slate-300'
                  }`}
                >
                  <span>{a.icon}</span>
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {activeAgent && (
          <p className="text-xs text-slate-500 truncate max-w-xs">{activeAgent.description}</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {!activeAgentSlug && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
            <Bot size={48} className="opacity-20" />
            <p className="text-sm">Selecciona un agente para empezar a chatear</p>
          </div>
        )}

        {activeAgentSlug && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
            <span className="text-4xl">{activeAgent?.icon}</span>
            <p className="text-sm font-medium text-slate-400">{activeAgent?.name}</p>
            <p className="text-xs text-slate-600">¿En qué te puedo ayudar?</p>
          </div>
        )}

        {messages.map(msg => <Message key={msg.id} msg={msg} />)}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center">
              <Bot size={13} className="text-slate-400" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border">
        <div className="flex gap-3 items-end bg-card border border-border rounded-2xl px-4 py-3 focus-within:border-primary/40 transition-colors">
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
            disabled={!input.trim() || !activeAgentSlug || isTyping}
            className="p-1.5 rounded-lg bg-primary hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-slate-700 mt-1.5 text-center">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </div>
  )
}
