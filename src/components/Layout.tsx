import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Sidebar, MobileMenuButton } from './Sidebar'
import { GlobalSearch } from './Search'
import { NotificationsPanel } from './NotificationsPanel'
import { useAuth } from '../context/AuthContext'
import {
  WifiOff, Search, Home, MessageSquare, Wallet, Bot,
  Trophy, Brain, TrendingUp, Heart, Layers, Network, Activity,
  Webhook, BarChart3, ScrollText, User, MoreHorizontal, X,
  Building2, ChevronRight, Zap,
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
  { to: '/growdata', icon: TrendingUp, label: 'GrowData'    },
  { to: '/life',     icon: Heart,      label: 'LIFE'        },
  { to: '/kronos',   icon: Network,    label: 'KRONOS'      },
  { to: '/banca',    icon: Building2,  label: 'Banca'       },
  { to: '/webhooks', icon: Webhook,    label: 'Webhooks'    },
  { to: '/profile',  icon: User,       label: 'Perfil'      },
]

const ROUTE_META: Record<string, { label: string; parent?: string }> = {
  '/home':     { label: 'Dashboard' },
  '/agents':   { label: 'Agentes',   parent: 'Orquestador' },
  '/chat':     { label: 'Chat',      parent: 'Orquestador' },
  '/metrics':  { label: 'Métricas',  parent: 'Orquestador' },
  '/logs':     { label: 'Logs',      parent: 'Orquestador' },
  '/finance':  { label: 'Finanzas',  parent: 'Sistemas'    },
  '/backlog':  { label: 'Backlog',   parent: 'Sistemas'    },
  '/health':   { label: 'Health',    parent: 'Sistemas'    },
  '/life':     { label: 'LIFE',      parent: 'Sistemas'    },
  '/kronos':   { label: 'KRONOS',    parent: 'Sistemas'    },
  '/banca':    { label: 'Banca',     parent: 'Sistemas'    },
  '/winstats': { label: 'WinStats',  parent: 'Sistemas'    },
  '/expertia': { label: 'ArchiTechIA',parent:'Sistemas'    },
  '/growdata': { label: 'GrowData',  parent: 'Sistemas'    },
  '/webhooks': { label: 'Webhooks',  parent: 'Sistemas'    },
  '/profile':  { label: 'Perfil',    parent: 'Cuenta'      },
}

function UserAvatar() {
  const { user } = useAuth()
  if (!user) return null
  const initials = (user.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')
    : user.email?.[0] ?? 'U'
  ).toUpperCase()
  return (
    <NavLink
      to="/profile"
      className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary hover:bg-primary/30 transition-colors"
      title={user.name || user.email}
    >
      {initials}
    </NavLink>
  )
}

function ConnectionStatus({ connected }: { connected: boolean | null }) {
  if (connected === null) {
    return (
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" />
        <span className="text-[10px] text-slate-600">verificando</span>
      </div>
    )
  }
  if (!connected) {
    return (
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
        <WifiOff className="w-3 h-3 text-red-400" />
        <span className="text-[10px] text-red-400">sin conexión</span>
      </div>
    )
  }
  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping-slow opacity-40" />
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      </div>
      <span className="text-[10px] text-emerald-400">live</span>
    </div>
  )
}

function PageBreadcrumb({ pathname }: { pathname: string }) {
  const meta = ROUTE_META[pathname]
  if (!meta) return null
  return (
    <div className="hidden md:flex items-center gap-1.5 text-xs">
      {meta.parent && (
        <>
          <span className="text-slate-600">{meta.parent}</span>
          <ChevronRight size={12} className="text-slate-700" />
        </>
      )}
      <span className="text-slate-400 font-medium">{meta.label}</span>
    </div>
  )
}

function MobileMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden" onClick={onClose} />
      <div className="fixed bottom-16 left-0 right-0 z-50 md:hidden animate-slide-up"
        style={{ background: 'rgba(10,10,22,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px 20px 0 0' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-primary" />
              <span className="text-xs font-semibold text-slate-300">Módulos</span>
            </div>
            <button onClick={onClose} className="p-1 text-slate-600 hover:text-white rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MORE_MODULES.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-primary/15 border border-primary/20 text-primary'
                      : 'bg-white/[0.04] border border-white/[0.06] text-slate-500 hover:text-slate-200 hover:bg-white/[0.07]'
                  }`
                }
              >
                <Icon size={18} />
                <span className="text-[9px] text-center leading-tight">{label}</span>
              </NavLink>
            ))}
          </div>
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
  const location = useLocation()

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved !== null) setSidebarCollapsed(JSON.parse(saved))
  }, [])

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

  const sidebarW = sidebarCollapsed ? 'md:ml-[64px]' : 'md:ml-[220px]'

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ease-in-out ${sidebarW} pb-16 md:pb-0`}>
        {/* Topbar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-5 border-b border-white/[0.05] flex-shrink-0"
          style={{
            height: 'var(--topbar-h)',
            background: 'rgba(8,8,15,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center gap-3">
            <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
            <ConnectionStatus connected={connected} />
            {connected !== null && (
              <div className="hidden md:block w-px h-4 bg-white/[0.08]" />
            )}
            <PageBreadcrumb pathname={location.pathname} />
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"
            >
              <Search className="w-3 h-3" />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden sm:inline text-[9px] px-1.5 py-0.5 bg-white/[0.08] rounded text-slate-600 font-mono">⌘K</kbd>
            </button>

            <NotificationsPanel />
            <UserAvatar />
          </div>
        </header>

        {/* Page content */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="flex-1 flex flex-col"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2 border-t border-white/[0.06]"
        style={{ background: 'rgba(8,8,15,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        {MOBILE_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-slate-600 hover:text-slate-400'
              }`
            }
          >
            <Icon size={19} />
            <span className="text-[9px] font-medium">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(v => !v)}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
            moreOpen ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          <MoreHorizontal size={19} />
          <span className="text-[9px] font-medium">Más</span>
        </button>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}