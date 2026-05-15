import { NavLink } from 'react-router-dom'
import { Bot, MessageSquare, BarChart3, ScrollText, Wifi, WifiOff, PanelLeftClose, PanelLeft, Home, Trophy, Brain, TrendingUp, Heart, Wallet, Layers, LogOut, X, Menu, User, Network, Activity, Webhook } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../store/dashboardStore'

const MAIN_FJ_NAV = [
  { to: '/agents',  icon: Bot,           label: 'Agentes'  },
  { to: '/chat',    icon: MessageSquare, label: 'Chat'     },
  { to: '/metrics', icon: BarChart3,     label: 'Métricas' },
  { to: '/logs',    icon: ScrollText,    label: 'Logs'     },
]

const SYSTEMS_NAV = [
  { to: '/home',     icon: Home,       label: 'Home'        },
  { to: '/finance',  icon: Wallet,     label: 'Finanzas'    },
  { to: '/backlog',  icon: Layers,     label: 'Backlog'     },
  { to: '/kronos',   icon: Network,    label: 'KRONOS'      },
  { to: '/winstats', icon: Trophy,     label: 'WinStats'    },
  { to: '/expertia', icon: Brain,      label: 'ArchiTechIA' },
  { to: '/growdata', icon: TrendingUp, label: 'Grow Data'   },
  { to: '/life',     icon: Heart,      label: 'LIFE'        },
  { to: '/health',   icon: Activity,   label: 'Health'      },
  { to: '/webhooks', icon: Webhook,    label: 'Webhooks'    },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

function SidebarContent({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user, logout } = useAuth()
  const sseConnected = useDashboard(s => s.sseConnected)

  const navClass = (isActive: boolean, activeColor: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive ? activeColor : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
    } ${collapsed ? 'justify-center' : ''}`

  return (
    <>
      <div className={`flex items-center border-b border-border ${collapsed ? 'justify-center px-2 py-4' : 'gap-2.5 px-5 py-5'}`}>
        {!collapsed && (
          <div className="flex-1">
            <div className="text-lg font-bold text-white tracking-wide">OPEN</div>
            <div className="text-[10px] text-slate-500 tracking-widest uppercase">Orchestrator</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {!collapsed && (
          <div className="px-5 pt-4 pb-1">
            <span className="text-[10px] text-slate-600 uppercase tracking-widest">Orquestador</span>
          </div>
        )}
        <nav className={`py-2 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {MAIN_FJ_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined}
              className={({ isActive }) => navClass(isActive, 'bg-primary/15 text-primary border border-primary/20')}>
              <Icon size={16} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="px-5 pt-4 pb-1">
            <span className="text-[10px] text-slate-600 uppercase tracking-widest">Sistemas</span>
          </div>
        )}
        <nav className={`py-2 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {SYSTEMS_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined}
              className={({ isActive }) => navClass(isActive, 'bg-accent/15 text-accent border border-accent/20')}>
              <Icon size={16} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="px-5 pt-4 pb-1">
            <span className="text-[10px] text-slate-600 uppercase tracking-widest">Cuenta</span>
          </div>
        )}
        <nav className={`py-2 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          <NavLink to="/profile"
            className={({ isActive }) => navClass(isActive, 'bg-success/15 text-success border border-success/20')}>
            <User size={16} />
            {!collapsed && <span>Perfil</span>}
          </NavLink>
        </nav>
      </div>

      {user && (
        <div className="mt-auto border-t border-border">
          <button
            onClick={logout}
            className={`flex items-center gap-2 w-full px-3 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-xs">Salir</span>}
          </button>
        </div>
      )}

      <div className={`px-5 py-4 border-t border-border ${collapsed ? 'px-2' : ''}`}>
        <div className="flex items-center justify-between">
          {!collapsed && <div className="text-[10px] text-slate-600 tracking-widest uppercase">FJ · v0.3.0</div>}
          <div className="flex items-center gap-1" title={sseConnected ? 'SSE conectado' : 'SSE desconectado'}>
            {sseConnected
              ? <Wifi size={10} className="text-success animate-pulse" />
              : <WifiOff size={10} className="text-slate-700" />}
          </div>
        </div>
      </div>
    </>
  )
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      <aside className={`hidden md:flex fixed left-0 top-0 h-screen bg-surface border-r border-border flex-col z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
        <SidebarContent collapsed={collapsed} onToggle={onToggle} />
      </aside>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={onMobileClose} />
          <aside className="fixed left-0 top-0 h-screen w-64 bg-surface border-r border-border flex flex-col z-50 md:hidden animate-slide-in">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <div>
                <div className="text-lg font-bold text-white tracking-wide">OPEN</div>
                <div className="text-[10px] text-slate-500 tracking-widest uppercase">Orchestrator</div>
              </div>
              <button onClick={onMobileClose} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <SidebarContent collapsed={false} onToggle={() => { onToggle(); onMobileClose() }} />
          </aside>
        </>
      )}
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
      aria-label="Abrir menu"
    >
      <Menu size={20} />
    </button>
  )
}