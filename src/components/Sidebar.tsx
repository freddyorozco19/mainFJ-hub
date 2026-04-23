import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Bot, MessageSquare, BarChart3, ScrollText, Wifi, WifiOff, PanelLeftClose, PanelLeft, Home, Trophy, Brain, TrendingUp, Heart, Wallet, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

const MAIN_FJ_NAV = [
  { to: '/agents',  icon: Bot,            label: 'Agentes'  },
  { to: '/chat',    icon: MessageSquare,  label: 'Chat'     },
  { to: '/metrics', icon: BarChart3,      label: 'Métricas' },
  { to: '/logs',    icon: ScrollText,     label: 'Logs'     },
]

const SYSTEMS_NAV = [
  { to: '/home',       icon: Home,        label: 'Home'        },
  { to: '/finance',    icon: Wallet,      label: 'Finanzas'    },
  { to: '/winstats',   icon: Trophy,      label: 'WinStats'    },
  { to: '/expertia',   icon: Brain,       label: 'ArchiTechIA' },
  { to: '/growdata',   icon: TrendingUp,  label: 'Grow Data'   },
  { to: '/life',       icon: Heart,       label: 'LIFE'        },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [sseConnected, setSseConnected] = useState(false)
  const { user, logout } = useAuth()

  useEffect(() => {
    const es = new EventSource(`${API}/events`)
    es.onopen = () => setSseConnected(true)
    es.onerror = () => setSseConnected(false)
    return () => { es.close() }
  }, [])

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-surface border-r border-border flex flex-col z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className={`flex items-center border-b border-border ${collapsed ? 'justify-center px-2 py-4' : 'gap-2.5 px-5 py-5'}`}>
        {!collapsed && (
          <div>
            <div className="text-lg font-bold text-white tracking-wide">OPEN</div>
            <div className="text-[10px] text-slate-500 tracking-widest uppercase">Orchestrator</div>
          </div>
        )}
      </div>

      {/* MainFJ Section */}
      {!collapsed && (
        <div className="px-5 pt-4 pb-1">
          <span className="text-[10px] text-slate-600 uppercase tracking-widest">Orquestador</span>
        </div>
      )}
      <nav className={`py-2 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {MAIN_FJ_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Icon size={16} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Systems Section */}
      {!collapsed && (
        <div className="px-5 pt-4 pb-1">
          <span className="text-[10px] text-slate-600 uppercase tracking-widest">Sistemas</span>
        </div>
      )}
      <nav className={`py-2 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {SYSTEMS_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-accent/15 text-accent border border-accent/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Icon size={16} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Toggle button & Logout */}
      <div className="flex flex-col gap-1 mt-auto border-t border-border">
        {user && (
          <button
            onClick={logout}
            className={`flex items-center gap-2 px-3 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors ${collapsed ? 'justify-center' : ''}`}
            title="Cerrar sesión"
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-xs">Salir</span>}
          </button>
        )}
        <button
          onClick={onToggle}
          className={`flex items-center gap-2 px-3 py-3 text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <PanelLeft size={16} /> : <><PanelLeftClose size={16} /><span className="text-xs">Colapsar</span></>}
        </button>
      </div>

      {/* Footer */}
      <div className={`px-5 py-4 border-t border-border ${collapsed ? 'px-2' : ''}`}>
        <div className="flex items-center justify-between">
          {!collapsed && <div className="text-[10px] text-slate-600 tracking-widest uppercase">FJ · v0.2.0</div>}
          <div className="flex items-center gap-1" title={sseConnected ? 'SSE conectado' : 'SSE desconectado'}>
            {sseConnected
              ? <Wifi size={10} className="text-success animate-pulse" />
              : <WifiOff size={10} className="text-slate-700" />
            }
          </div>
        </div>
      </div>
    </aside>
  )
}
