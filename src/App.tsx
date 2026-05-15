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
import { KRONOS } from './pages/KRONOS'
import { Profile } from './pages/Profile'
import { Backlog } from './pages/Backlog'
import { Health } from './pages/Health'
import { Webhooks } from './pages/Webhooks'
import { Login } from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { ToastProvider, useToast } from './components/Toast'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { getToken } from './api'
import { useDashboard } from './store/dashboardStore'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

function SSEListener() {
  const esRef = useRef<EventSource | null>(null)
  const retriesRef = useRef(0)
  const {
    updateAgentStatus, addMessage, setTyping, pushLog, pushNotification,
    setSseConnected, tickFinanceRefresh,
  } = useDashboard()
  const { addToast } = useToast()

  function attachListeners(es: EventSource) {
    es.onopen = () => { setSseConnected(true); retriesRef.current = 0 }
    es.onerror = () => {
      setSseConnected(false)
      es.close()
      const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000)
      retriesRef.current++
      setTimeout(reconnect, delay)
    }

    es.addEventListener('agent:status', (e) => {
      const { slug, status } = JSON.parse(e.data)
      updateAgentStatus(slug, status)
    })
    es.addEventListener('chat:message', (e) => {
      const { agent_slug, role, content, tokens } = JSON.parse(e.data)
      addMessage({ id: crypto.randomUUID(), role, content, agentSlug: agent_slug, timestamp: new Date().toISOString(), tokens })
      if (role === 'assistant') setTyping(false)
    })
    es.addEventListener('chat:typing', (e) => {
      const { is_typing } = JSON.parse(e.data)
      setTyping(is_typing)
    })
    es.addEventListener('log:new', (e) => {
      const { level, agent_slug, action, detail, duration_ms } = JSON.parse(e.data)
      pushLog({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), level, agentSlug: agent_slug, action, detail, durationMs: duration_ms })
    })
    es.addEventListener('alert:cost', (e) => {
      const { agent_slug, cost, threshold } = JSON.parse(e.data)
      const msg = `${agent_slug}: $${cost} (umbral $${threshold})`
      addToast({ message: msg, type: 'warn' })
      pushNotification({ message: msg, type: 'warn' })
    })
    es.addEventListener('finance:written', (e) => {
      const { tab, confirmation } = JSON.parse(e.data)
      const msg = `Finanzas: ${confirmation} → ${tab}`
      addToast({ message: msg, type: 'success' })
      pushNotification({ message: msg, type: 'success' })
      tickFinanceRefresh()
    })
    es.addEventListener('system', (e) => {
      const { message, level } = JSON.parse(e.data)
      const t = (level as 'info' | 'success' | 'warn' | 'error') || 'info'
      addToast({ message, type: t })
      pushNotification({ message, type: t })
    })
  }

  function reconnect() {
    const t = getToken()
    const url = t ? `${API}/events?token=${encodeURIComponent(t)}` : `${API}/events`
    const es = new EventSource(url)
    esRef.current = es
    attachListeners(es)
  }

  useEffect(() => {
    reconnect()
    return () => { esRef.current?.close() }
  }, [])

  return null
}

function AppInner() {
  return (
    <>
      <SSEListener />
      <ToastProvider />
      <Routes>
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route element={<Layout />}>
          <Route element={<ProtectedRoute />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="/agents"  element={<Agents />}  />
            <Route path="/chat"    element={<Chat />}    />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/logs"    element={<Logs />}    />
            <Route path="/home"    element={<Home />}    />
            <Route path="/winstats" element={<WinStats />} />
            <Route path="/expertia" element={<ExpertIA />} />
            <Route path="/growdata" element={<GrowData />} />
            <Route path="/life"    element={<LIFE />}    />
            <Route path="/finance" element={<Finance />} />
            <Route path="/kronos"  element={<KRONOS />}  />
            <Route path="/health"  element={<Health />}  />
            <Route path="/webhooks" element={<Webhooks />} />
            <Route path="/backlog" element={<Backlog />}  />
            <Route path="/profile" element={<Profile />}  />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}