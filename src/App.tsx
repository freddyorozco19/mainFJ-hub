import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Agents } from './pages/Agents'
import { Chat } from './pages/Chat'
import { Metrics } from './pages/Metrics'
import { Logs } from './pages/Logs'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/agents" replace />} />
        <Route path="/agents"  element={<Agents />}  />
        <Route path="/chat"    element={<Chat />}    />
        <Route path="/metrics" element={<Metrics />} />
        <Route path="/logs"    element={<Logs />}    />
      </Route>
    </Routes>
  )
}
