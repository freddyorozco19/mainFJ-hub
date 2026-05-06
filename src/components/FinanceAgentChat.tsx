import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, X, Send, Loader2, Check, Trash2, Edit3, Plus, AlertCircle, User, Eraser } from 'lucide-react'
import { api } from '../api'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  action?: AgentAction
  timestamp: string
}

export interface AgentAction {
  type: 'none' | 'create' | 'update' | 'delete' | 'switch_tab'
  tab?: string
  data?: Record<string, string | number>
  row_index?: number
  confirmation?: string
}

interface AgentResponse {
  text: string
  action: AgentAction | null
  needs_confirmation: boolean
}

interface FinanceAgentChatProps {
  isOpen: boolean
  onClose: () => void
  currentTab: string
  records: Record<string, string | number>[]
  onActionExecuted: (action: AgentAction) => void
  onRefresh: () => void
}

const STORAGE_KEY = 'finance_agent_chat'

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return [
    {
      role: 'assistant',
      content: '¡Hola! Soy FINANCE, tu agente de gestión financiera. Puedo ayudarte a registrar, editar o eliminar cualquier registro. ¿Qué necesitas hacer hoy?',
      timestamp: new Date().toISOString(),
    },
  ]
}

function saveMessages(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs))
  } catch { /* ignore */ }
}

export function FinanceAgentChat({
  isOpen,
  onClose,
  currentTab,
  records,
  onActionExecuted,
  onRefresh,
}: FinanceAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<AgentAction | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Persistir mensajes
  useEffect(() => {
    saveMessages(messages)
  }, [messages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const clearChat = () => {
    const fresh = [
      {
        role: 'assistant',
        content: '¡Hola! Soy FINANCE, tu agente de gestión financiera. Puedo ayudarte a registrar, editar o eliminar cualquier registro. ¿Qué necesitas hacer hoy?',
        timestamp: new Date().toISOString(),
      },
    ] as ChatMessage[]
    setMessages(fresh)
    setPendingAction(null)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await api('/finance/agent', {
        method: 'POST',
        body: {
          message: userMsg.content,
          history,
          current_tab: currentTab,
        },
      })

      if (!res.ok) {
        throw new Error('Error en el agente')
      }

      const data: AgentResponse = await res.json()

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.text,
        action: data.action || undefined,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMsg])

      // Si la acción necesita confirmación, la guardamos
      if (data.needs_confirmation && data.action) {
        setPendingAction(data.action)
      } else if (data.action && data.action.type !== 'none') {
        // Acción ejecutada automáticamente
        onActionExecuted(data.action)
        if (data.action.type === 'create' || data.action.type === 'update' || data.action.type === 'delete') {
          onRefresh()
        }
      }
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ Error: ${e.message || 'No pude procesar tu solicitud. Intenta de nuevo.'}`,
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const confirmAction = async () => {
    if (!pendingAction) return

    setLoading(true)
    try {
      const res = await api('/finance/records', {
        method: pendingAction.type === 'delete' ? 'DELETE' : pendingAction.type === 'update' ? 'PUT' : 'POST',
        body:
          pendingAction.type === 'delete'
            ? { tab: pendingAction.tab, row_index: pendingAction.row_index }
            : pendingAction.type === 'update'
            ? { tab: pendingAction.tab, row_index: pendingAction.row_index, data: pendingAction.data }
            : { tab: pendingAction.tab, data: pendingAction.data },
      })

      if (!res.ok) throw new Error('Error ejecutando acción')

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `✅ Acción confirmada: ${pendingAction.confirmation || 'Registro actualizado correctamente'}`,
          timestamp: new Date().toISOString(),
        },
      ])

      onActionExecuted(pendingAction)
      onRefresh()
      setPendingAction(null)
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ Error al confirmar: ${e.message || 'No se pudo ejecutar la acción'}`,
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const cancelAction = () => {
    setPendingAction(null)
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: 'Acción cancelada. ¿Hay algo más en lo que pueda ayudarte?',
        timestamp: new Date().toISOString(),
      },
    ])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const getActionIcon = (type?: string) => {
    switch (type) {
      case 'create': return <Plus size={12} className="text-emerald-400" />
      case 'update': return <Edit3 size={12} className="text-amber-400" />
      case 'delete': return <Trash2 size={12} className="text-red-400" />
      default: return null
    }
  }

  // Datos del registro para confirmación inteligente
  const getRecordForConfirmation = () => {
    if (!pendingAction) return null
    if (pendingAction.row_index !== undefined && pendingAction.row_index >= 0 && pendingAction.row_index < records.length) {
      return records[pendingAction.row_index]
    }
    return pendingAction.data || null
  }

  const confirmRecord = getRecordForConfirmation()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col" style={{ height: '70vh', maxHeight: '600px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center">
              <Bot size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">FINANCE</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-slate-400">Agente de finanzas activo</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              title="Limpiar conversación"
              className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-white/5"
            >
              <Eraser size={14} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === 'user'
                  ? 'bg-slate-700'
                  : 'bg-primary/20 border border-primary/30'
              }`}>
                {msg.role === 'user' ? (
                  <User size={13} className="text-slate-300" />
                ) : (
                  <Bot size={13} className="text-primary" />
                )}
              </div>

              {/* Bubble */}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary/20 text-white rounded-br-md'
                  : 'bg-surface border border-border text-slate-300 rounded-bl-md'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Action badge */}
                {msg.action && msg.action.type !== 'none' && (
                  <div className={`mt-2 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md ${
                    msg.action.type === 'create' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : msg.action.type === 'delete' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : msg.action.type === 'update' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                  }`}>
                    {getActionIcon(msg.action.type)}
                    <span className="uppercase font-medium">{msg.action.type}</span>
                    {msg.action.tab && <span>· {msg.action.tab}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <Bot size={13} className="text-primary" />
              </div>
              <div className="bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Confirmation prompt inteligente */}
          {pendingAction && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertCircle size={13} className="text-amber-400" />
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl rounded-bl-md px-4 py-3 flex-1">
                <p className="text-sm text-amber-300 mb-3 font-medium">
                  ¿Confirmas esta acción?
                </p>

                {/* Tarjeta con datos del registro */}
                {confirmRecord && (
                  <div className="mb-3 bg-black/20 border border-amber-500/10 rounded-lg p-3">
                    <p className="text-[10px] text-amber-500/70 uppercase font-medium mb-1.5 tracking-wider">
                      {pendingAction.type === 'delete' ? 'Registro a eliminar'
                        : pendingAction.type === 'update' ? 'Registro a actualizar'
                        : 'Datos del registro'}
                    </p>
                    <div className="space-y-1">
                      {Object.entries(confirmRecord).slice(0, 6).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-slate-500">{key}</span>
                          <span className="text-slate-300 truncate max-w-[180px]" title={String(value)}>{String(value)}</span>
                        </div>
                      ))}
                      {Object.keys(confirmRecord).length > 6 && (
                        <p className="text-[10px] text-slate-600 mt-1">+ {Object.keys(confirmRecord).length - 6} campos más</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={confirmAction}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check size={12} />
                    Confirmar
                  </button>
                  <button
                    onClick={cancelAction}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X size={12} />
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border bg-surface/50 rounded-b-2xl">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe una acción: 'registrar gasto de 50k en Zara'..."
              disabled={loading || !!pendingAction}
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading || !!pendingAction}
              className="flex items-center justify-center w-10 h-10 bg-primary hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2 text-center">
            El agente puede crear, editar y eliminar registros. Escribe en lenguaje natural.
          </p>
        </div>
      </div>
    </div>
  )
}
