import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bot, MessageSquare, BarChart3, ScrollText, PanelLeftClose, PanelLeft,
  Home, Trophy, Brain, TrendingUp, Heart, Wallet, LogOut, X, Menu,
  User, Network, Activity, Webhook, Building2, Layers, Zap, Cpu,
  GraduationCap, ShoppingCart,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getToken } from '../api'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

/* ── Module color maps ─────────────────────────────────────── */
const MODULE_COLORS: Record<string, { icon: string; bg: string; glow: string }> = {
  '/agents':          { icon: 'text-violet-400',  bg: 'bg-violet-500/10  border-violet-500/20',  glow: 'shadow-[0_0_12px_rgba(139,92,246,0.3)]'  },
  '/chat':            { icon: 'text-blue-400',    bg: 'bg-blue-500/10    border-blue-500/20',    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.3)]'   },
  '/metrics':         { icon: 'text-indigo-400',  bg: 'bg-indigo-500/10  border-indigo-500/20',  glow: 'shadow-[0_0_12px_rgba(99,102,241,0.3)]'   },
  '/logs':            { icon: 'text-slate-400',   bg: 'bg-slate-500/10   border-slate-500/20',   glow: 'shadow-[0_0_12px_rgba(100,116,139,0.3)]'  },
  '/home':            { icon: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]'   },
  '/finance':         { icon: 'text-green-400',   bg: 'bg-green-500/10   border-green-500/20',   glow: 'shadow-[0_0_12px_rgba(34,197,94,0.3)]'    },
  '/kronos':          { icon: 'text-orange-400',  bg: 'bg-orange-500/10  border-orange-500/20',  glow: 'shadow-[0_0_12px_rgba(249,115,22,0.3)]'   },
  '/winstats':        { icon: 'text-yellow-400',  bg: 'bg-yellow-500/10  border-yellow-500/20',  glow: 'shadow-[0_0_12px_rgba(234,179,8,0.3)]'    },
  '/expertia':        { icon: 'text-pink-400',    bg: 'bg-pink-500/10    border-pink-500/20',    glow: 'shadow-[0_0_12px_rgba(236,72,153,0.3)]'   },
  '/growdata':        { icon: 'text-teal-400',    bg: 'bg-teal-500/10    border-teal-500/20',    glow: 'shadow-[0_0_12px_rgba(20,184,166,0.3)]'   },
  '/life':            { icon: 'text-rose-400',    bg: 'bg-rose-500/10    border-rose-500/20',    glow: 'shadow-[0_0_12px_rgba(244,63,94,0.3)]'    },
  '/health':          { icon: 'text-red-400',     bg: 'bg-red-500/10     border-red-500/20',     glow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]'    },
  '/webhooks':        { icon: 'text-cyan-400',    bg: 'bg-cyan-500/10    border-cyan-500/20',    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.3)]'    },
  '/banca':           { icon: 'text-sky-400',     bg: 'bg-sky-500/10     border-sky-500/20',     glow: 'shadow-[0_0_12px_rgba(14,165,233,0.3)]'   },
  '/backlog':         { icon: 'text-purple-400',  bg: 'bg-purple-500/10  border-purple-500/20',  glow: 'shadow-[0_0_12px_rgba(168,85,247,0.3)]'   },
  '/certifications':  { icon: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]'   },
  '/rappi-prices':    { icon: 'text-orange-400',  bg: 'bg-orange-500/10  border-orange-500/20',  glow: 'shadow-[0_0_12px_rgba(249,115,22,0.3)]'   },
  '/profile':         { icon: 'text-amber-400',   bg: 'bg-amber-500/10   border-amber-500/20',   glow: 'shadow-[0_0_12px_rgba(245,158,11,0.3)]'   },
}

const ORCHESTRATOR_NAV = [
  { to: '/agents',  icon: Bot,           label: 'Agentes'  },
  { to: '/chat',    icon: MessageSquare, label: 'Chat'     },
  { to: '/metrics', icon: BarChart3,     label: 'Métricas' },
  { to: '/logs',    icon: ScrollText,    label: 'Logs'     },
]

const SYSTEMS_NAV = [
  { to: '/home',           icon: Home,          label: 'Home'           },
  { to: '/finance',        icon: Wallet,        label: 'Finanzas'       },
  { to: '/backlog',        icon: Layers,        label: 'Backlog'        },
  { to: '/health',         icon: Activity,      label: 'Health'         },
  { to: '/life',           icon: Heart,         label: 'LIFE'           },
  { to: '/kronos',         icon: Network,       label: 'KRONOS'         },
  { to: '/banca',          icon: Building2,     label: 'Banca'          },
  { to: '/winstats',       icon: Trophy,        label: 'WinStats'       },
  { to: '/expertia',       icon: Brain,         label: 'ArchiTechIA'    },
  { to: '/growdata',       icon: TrendingUp,    label: 'GrowData'       },
  { to: '/webhooks',       icon: Webhook,       label: 'Webhooks'       },
  { to: '/certifications', icon: GraduationCap, label: 'Certificaciones'},
  { to: '/rappi-prices',   icon: ShoppingCart,  label: 'Rappi Scan'    },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

function NavItem({ to, icon: Icon, label, collapsed }: { to: string; icon: React.ElementType; label: string; collapsed: boolean }) {
  const colors = MODULE_COLORS[to] ?? { icon: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', glow: '' }

  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? `bg-white/[0.06] border border-white/[0.08] text-white nav-active-glow`
            : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
        } ${collapsed ? 'justify-center' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border transition-all duration-200 ${
            isActive ? `${colors.bg} ${colors.glow}` : `bg-white/[0.03] border-white/[0.05] group-hover:${colors.bg}`
          }`}>
            <Icon size={14} className={isActive ? colors.icon : `text-slate-600 group-hover:${colors.icon} transition-colors`} />
          </div>
          {!collapsed && (
            <span className="flex-1 truncate tracking-tight">{label}</span>
          )}
          {!collapsed && isActive && (
            <div className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
          )}
        </>
      )}
    </NavLink>
  )
}

function SidebarContent({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [sseConnected, setSseConnected] = useState(false)
  const { user, logout } = useAuth()

  useEffect(() => {
    const token = getToken() ?? ''
    const es = new EventSource(`${API}/events?token=${token}`)
    es.onopen = () => setSseConnected(true)
    es.onerror = () => setSseConnected(false)
    return () => { es.close() }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center border-b border-white/[0.05] flex-shrink-0 ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-4 py-4'}`}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(124,58,237,0.5)]">
                <Zap size={12} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-white tracking-wide leading-none">FJ Hub</div>
                <div className="text-[9px] text-slate-600 tracking-widest uppercase mt-0.5">Orchestrator</div>
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(124,58,237,0.5)] mb-1">
            <Zap size={14} className="text-white" />
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex-shrink-0 flex items-center justify-center p-1.5 text-slate-600 hover:text-slate-300 hover:bg-white/[0.05] rounded-lg transition-colors"
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* Nav scroll area */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4">

        {/* Orchestrator section */}
        <div>
          {!collapsed && (
            <div className="px-4 mb-1.5">
              <span className="section-label flex items-center gap-1.5">
                <Cpu size={9} />
                Orquestador
              </span>
            </div>
          )}
          <div className={`space-y-0.5 ${collapsed ? 'px-2' : 'px-2'}`}>
            {ORCHESTRATOR_NAV.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="px-4">
          <div className="divider" />
        </div>

        {/* Systems section */}
        <div>
          {!collapsed && (
            <div className="px-4 mb-1.5">
              <span className="section-label">Sistemas</span>
            </div>
          )}
          <div className={`space-y-0.5 ${collapsed ? 'px-2' : 'px-2'}`}>
            {SYSTEMS_NAV.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="px-4">
          <div className="divider" />
        </div>

        {/* Account section */}
        <div>
          {!collapsed && (
            <div className="px-4 mb-1.5">
              <span className="section-label">Cuenta</span>
            </div>
          )}
          <div className={`space-y-0.5 ${collapsed ? 'px-2' : 'px-2'}`}>
            <NavItem to="/profile" icon={User} label="Perfil" collapsed={collapsed} />
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-white/[0.05]">
        {/* User row */}
        {user && !collapsed && (
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0">
                {(user.name ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('') : user.email?.[0] ?? 'U').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-300 truncate">{user.name || user.email?.split('@')[0]}</div>
                <div className="text-[10px] text-slate-600 truncate">{user.email}</div>
              </div>
            </div>
          </div>
        )}

        {/* Status + logout row */}
        <div className={`flex items-center px-3 pb-3 ${collapsed ? 'flex-col gap-2 pt-3' : 'justify-between'}`}>
          {/* Connection indicator */}
          <div className={`flex items-center gap-1.5 ${collapsed ? '' : 'px-1'}`} title={sseConnected ? 'Conectado' : 'Sin conexión'}>
            <div className="relative">
              {sseConnected && <div className="absolute inset-0 rounded-full bg-success animate-ping-slow opacity-40" />}
              <div className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-success' : 'bg-slate-700'}`} />
            </div>
            {!collapsed && (
              <span className="text-[10px] text-slate-600">{sseConnected ? 'live' : 'offline'}</span>
            )}
          </div>

          {/* Version */}
          {!collapsed && <span className="text-[10px] text-slate-700">v0.3.0</span>}

          {/* Logout */}
          {user && (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={13} />
              {!collapsed && <span className="text-xs">Salir</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-screen flex-col z-40 transition-all duration-300 ease-in-out border-r border-white/[0.05] ${
          collapsed ? 'w-[var(--sidebar-w-sm)]' : 'w-[var(--sidebar-w)]'
        }`}
        style={{ background: 'linear-gradient(180deg, #07070E 0%, #0A0A18 50%, #07070E 100%)' }}
      >
        <SidebarContent collapsed={collapsed} onToggle={onToggle} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
            onClick={onMobileClose}
          />
          <aside
            className="fixed left-0 top-0 h-screen w-64 flex flex-col z-50 md:hidden animate-slide-in border-r border-white/[0.05]"
            style={{ background: 'linear-gradient(180deg, #07070E 0%, #0A0A18 50%, #07070E 100%)' }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.05] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(124,58,237,0.5)]">
                  <Zap size={14} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">FJ Hub</div>
                  <div className="text-[9px] text-slate-600 tracking-widest uppercase">Orchestrator</div>
                </div>
              </div>
              <button onClick={onMobileClose} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors">
                <X size={16} />
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
      className="md:hidden p-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
      aria-label="Abrir menú"
    >
      <Menu size={18} />
    </button>
  )
}
