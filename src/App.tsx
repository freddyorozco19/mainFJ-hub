import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Agents } from './pages/Agents'
import { Chat } from './pages/Chat'
import { Metrics } from './pages/Metrics'
import { Logs } from './pages/Logs'
import { Home } from './pages/Home'
import { WinStats } from './pages/WinStats'
import { ExpertIA } from './pages/ExpertIA'
import { GrowData } from './pages/GrowData'
import { LIFE } from './pages/LIFE'
import { Finance } from './pages/Finance'
import { Login } from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useDashboard } from './store/dashboardStore'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

function SSEListener() {
  const esRef = useRef<EventSource | null>(null)
  const { updateAgentStatus, addMessage, setTyping, pushLog } = useDashboard()

  useEffect(() => {
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
      if (role === 'assistant') setTyping(false)
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
      ;(window as any).__addToast?.({
        message: `${agent_slug}: $${cost} (umbral $${threshold})`,
        type: 'warn',
      })
    })

    es.addEventListener('finance:written', (e) => {
      const { tab, confirmation } = JSON.parse(e.data)
      ;(window as any).__addToast?.({
        message: `Finanzas: ${confirmation} → ${tab}`,
        type: 'success',
      })
    })

    es.addEventListener('system', (e) => {
      const { message, level } = JSON.parse(e.data)
      ;(window as any).__addToast?.({
        message,
        type: (level as 'info' | 'success' | 'warn' | 'error') || 'info',
      })
    })

    es.onerror = () => {
      es.close()
      setTimeout(() => {
        if (esRef.current?.readyState === EventSource.CLOSED) {
          window.location.reload()
        }
      }, 3000)
    }

    return () => { es.close() }
  }, [updateAgentStatus, addMessage, setTyping, pushLog])

  return null
}

export default function App() {
  return (
    <AuthProvider>
      <SSEListener />
      <ToastProvider />
      <Routes>
        {/* Login público */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Rutas protegidas con Layout */}
        <Route element={<Layout />}>
          <Route element={<ProtectedRoute />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="/agents"  element={<Agents />}  />
            <Route path="/chat"    element={<Chat />}    />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/logs"    element={<Logs />}    />
            <Route path="/home"     element={<Home />}    />
            <Route path="/winstats" element={<WinStats />} />
            <Route path="/expertia" element={<ExpertIA />} />
            <Route path="/growdata" element={<GrowData />} />
            <Route path="/life"    element={<LIFE />}    />
            <Route path="/finance" element={<Finance />} />
          </Route>
        </Route>

        {/* Cualquier otra ruta → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
