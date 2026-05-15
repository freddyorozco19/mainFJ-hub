import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Sidebar, MobileMenuButton } from './Sidebar'
import { GlobalSearch } from './Search'
import { NotificationsPanel } from './NotificationsPanel'
import { useAuth } from '../context/AuthContext'
import {
  WifiOff, Wifi, Moon, Sun, Search, Home, MessageSquare, Wallet, Bot,
  Trophy, Brain, TrendingUp, Heart, Layers, Network, Activity, Webhook,
  BarChart3, ScrollText, User, MoreHorizontal, X,
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

const MOBILE_NAV = [
  { to: '/home',    icon: Home,          label: 'Home'     },
  { to: '/chat',    icon: MessageSquare, label: 'Chat'     },
  { to: '/finance', icon: Wallet,        label: 'Finanzas' },
  { to: '/agents',  icon: Bot,           label: 'Agentes'  },
]

const MORE_MODULES = [
  { to: '/metrics',  icon: BarChart3,  label: 'Métricas'    },
  { to: '/logs',     icon: ScrollText, label: 'Logs'        },
  { to: '/backlog',  icon: Layers,     label: 'Backlog'     },
  { to: '/health',   icon: Activity,   label: 'Health'      },
  { to: '/winstats', icon: Trophy,     label: 'WinStats'    },
  { to: '/expertia', icon: Brain,      label: 'ArchiTechIA' },
  { to: '/growdata', icon: TrendingUp, label: 'Grow Data'   },
  { to: '/life',     icon: Heart,      label: 'LIFE'        },
  { to: '/kronos',   icon: Network,    label: 'KRONOS'      },
  { to: '/webhooks', icon: Webhook,    label: 'Webhooks'    },
  { to: '/profile',  icon: User,       label: 'Perfil'      },
]

const ROUTE_LABELS: Record<string, string> = {
  '/home': 'Home', '/agents': 'Agentes', '/chat': 'Chat', '/metrics': 'Métricas',
  '/logs': 'Logs', '/finance': 'Finanzas', '/kronos': 'KRONOS', '/winstats': 'WinStats',
  '/expertia': 'ArchiTechIA', '/growdata': 'Grow Data', '/life': 'LIFE',
  '/health': 'Health', '/profile': 'Perfil', '/webhooks': 'Webhooks', '/backlog': 'Backlog',
}

function UserAvatar() {
  const { user } = useAuth()
  if (!user) return null
  const initials = user.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? 'U'
  return (
    <div
      className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary"
      title={user.name || user.email}
    >
      {initials}
    </div>
  )
}

function MobileMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden" onClick={onClose} />
      <div className="fixed bottom-16 left-0 right-0 z-50 md:hidden bg-surface/90 backdrop-blur-xl border-t border-white/10 rounded-t-2xl p-4 shadow-[0_-16px_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Más módulos</span>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MORE_MODULES.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'bg-card text-slate-400 hover:text-white hover:bg-white/5'}`
              }
            >
              <Icon size={20} />
              <span className="text-[9px] text-center leading-tight">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </>
  )
}

export function Layout() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })
  const location = useLocation()
  const pageTitle = ROUTE_LABELS[location.pathname] ?? ''

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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(v => !v) }
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

  useEffect(() => {
    const check = async () => {
      try { await fetch(`${API}/health`, { signal: AbortSignal.timeout(15000) }); setConnected(true) }
      catch { setConnected(false) }
    }
    check()
    const id = setInterval(check, connected === false ? 5000 : 30000)
    return () => clearInterval(id)
  }, [connected])

  return (
    <div className="min-h-screen flex bg-[#07070F] dark:bg-gray-950">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'} pb-16 md:pb-0`}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
            <div className={`hidden md:flex items-center gap-2 text-xs ${connected === false ? 'text-red-400' : 'text-white/40'}`}>
              {connected === null
                ? <span className="animate-pulse">verificando...</span>
                : connected
                  ? <Wifi className="w-3 h-3 text-white/30" />
                  : <><WifiOff className="w-3 h-3" /><span>Sin conexión</span></>
              }
            </div>
            {pageTitle && (
              <span className="hidden md:block text-xs font-medium text-white/70 border-l border-white/10 pl-3">{pageTitle}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:text-white/80 transition-colors"
            >
              <Search className="w-3 h-3" />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden sm:inline text-[10px] px-1 py-0.5 bg-white/10 rounded">⌘K</kbd>
            </button>
            <NotificationsPanel />
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-md transition-colors hover:bg-white/10 text-white/60 dark:text-yellow-400"
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <UserAvatar />
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="flex-1 flex flex-col"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/90 backdrop-blur-lg border-t border-white/8 flex items-center justify-around px-2 py-1.5">
        {MOBILE_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${isActive ? 'text-primary' : 'text-slate-500'}`
            }
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(v => !v)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${moreOpen ? 'text-primary' : 'text-slate-500'}`}
        >
          <MoreHorizontal size={20} />
          <span className="text-[10px]">Más</span>
        </button>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}