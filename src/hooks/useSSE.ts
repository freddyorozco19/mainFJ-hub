import { useEffect, useRef, useCallback } from 'react'
import { useDashboard } from '../store/dashboardStore'

const API = 'http://localhost:8001'

interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warn' | 'error'
}

interface UseSSEOptions {
  onToast?: (toast: Toast) => void
}

export function useSSE(options?: UseSSEOptions) {
  const esRef = useRef<EventSource | null>(null)
  const { updateAgentStatus, addMessage, setTyping, pushLog } = useDashboard()

  const reconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
    }

    const es = new EventSource(`${API}/events`)
    esRef.current = es

    es.addEventListener('agent:status', (e) => {
      const { slug, status } = JSON.parse(e.data)
      updateAgentStatus(slug, status)
    })

    es.addEventListener('chat:message', (e) => {
      const { agent_slug, role, content, tokens } = JSON.parse(e.data)
      addMessage({
        id: crypto.randomUUID(),
        role: role as 'user' | 'assistant',
        content,
        agentSlug: agent_slug,
        timestamp: new Date().toISOString(),
        tokens,
      })
      if (role === 'assistant') {
        setTyping(false)
      }
    })

    es.addEventListener('chat:typing', (e) => {
      const { is_typing } = JSON.parse(e.data)
      setTyping(is_typing)
    })

    es.addEventListener('log:new', (e) => {
      const { level, agent_slug, action, detail, duration_ms } = JSON.parse(e.data)
      pushLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level: level as 'info' | 'warn' | 'error' | 'success',
        agentSlug: agent_slug,
        action,
        detail,
        durationMs: duration_ms,
      })
    })

    es.addEventListener('alert:cost', (e) => {
      const { agent_slug, cost, threshold } = JSON.parse(e.data)
      options?.onToast?.({
        id: crypto.randomUUID(),
        message: `${agent_slug}: $${cost} (umbral $${threshold})`,
        type: 'warn',
      })
    })

    es.addEventListener('finance:written', (e) => {
      const { tab, confirmation } = JSON.parse(e.data)
      options?.onToast?.({
        id: crypto.randomUUID(),
        message: `Finanzas: ${confirmation} → ${tab}`,
        type: 'success',
      })
    })

    es.addEventListener('system', (e) => {
      const { message, level } = JSON.parse(e.data)
      options?.onToast?.({
        id: crypto.randomUUID(),
        message,
        type: (level as Toast['type']) || 'info',
      })
    })

    es.onerror = () => {
      es.close()
      // Reconnect after 3s
      setTimeout(reconnect, 3000)
    }
  }, [updateAgentStatus, addMessage, setTyping, pushLog, options])

  useEffect(() => {
    reconnect()
    return () => {
      esRef.current?.close()
    }
  }, [reconnect])

  return esRef.current
}
