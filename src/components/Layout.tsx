import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Sidebar, MobileMenuButton } from './Sidebar'
import { GlobalSearch } from './Search'
import { WifiOff, Wifi, Moon, Sun, Search, Home, MessageSquare, Wallet, Bot } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

const MOBILE_NAV = [
  { to: '/home',    icon: Home,           label: 'Home'    },
  { to: '/chat',    icon: MessageSquare,  label: 'Chat'    },
  { to: '/finance', icon: Wallet,         label: 'Finanzas'},
  { to: '/agents',  icon: Bot,            label: 'Agentes' },
]

export function Layout() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

      <main className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'} pb-16 md:pb-0`}>
        {/* Top bar */}
        <div className={`flex items-center justify-between px-4 py-2 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-white/10 bg-white/5'}`}>
          <div className="flex items-center gap-3">
            <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
            <div className={`hidden md:flex items-center gap-2 text-xs ${connected === false ? 'text-red-400' : darkMode ? 'text-gray-400' : 'text-white/60'}`}>
              {connected === null ? (
                <span className="animate-pulse">verificando...</span>
              ) : connected ? (
                <><Wifi className="w-3 h-3" /><span>Conectado</span></>
              ) : (
                <><WifiOff className="w-3 h-3" /><span>Sin conexión</span></>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${darkMode ? 'bg-gray-700 text-gray-400 hover:text-white' : 'bg-white/5 text-white/40 hover:text-white/80'}`}
            >
              <Search className="w-3 h-3" />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden sm:inline text-[10px] px-1 py-0.5 bg-white/10 rounded">⌘K</kbd>
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-1.5 rounded-md transition-colors ${darkMode ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-white/10 text-white/60'}`}
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border flex items-center justify-around px-2 py-1.5">
        {MOBILE_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${isActive ? 'text-primary' : 'text-slate-500'}`
            }
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg text-slate-500"
        >
          <Search size={20} />
          <span className="text-[10px]">Buscar</span>
        </button>
      </nav>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
