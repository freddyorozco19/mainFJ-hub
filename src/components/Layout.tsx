import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar, MobileMenuButton } from './Sidebar'
import { WifiOff, Wifi, Moon, Sun } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export function Layout() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved !== null) setSidebarCollapsed(JSON.parse(saved))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebarCollapsed', JSON.stringify(next))
      return next
    })
  }

  const checkConnection = async () => {
    try {
      await fetch(`${API}/health`, { signal: AbortSignal.timeout(15000) })
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }

  useEffect(() => {
    checkConnection()
    // Retry cada 5s hasta conectar, luego cada 30s
    const id = setInterval(() => {
      checkConnection()
    }, connected === false ? 5000 : 30000)
    return () => clearInterval(id)
  }, [connected])

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-900' : 'bg-[#07070F]'}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <main className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'}`}>
        <div className={`flex items-center justify-between px-4 py-2 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-white/10 bg-white/5'}`}>
          <div className="flex items-center gap-3">
            <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
            <div className={`hidden md:flex items-center gap-2 text-xs ${connected === false ? 'text-red-400' : darkMode ? 'text-gray-400' : 'text-white/60'}`}>
              {connected === null ? (
                <span className="animate-pulse">verificando...</span>
              ) : connected ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>Conectado</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span>Sin conexión</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-1.5 rounded-md transition-colors ${darkMode ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-white/10 text-white/60'}`}
            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
