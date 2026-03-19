import { NavLink } from 'react-router-dom'
import { Bot, MessageSquare, BarChart3, ScrollText, Zap } from 'lucide-react'

const NAV = [
  { to: '/agents',  icon: Bot,            label: 'Agentes'  },
  { to: '/chat',    icon: MessageSquare,  label: 'Chat'     },
  { to: '/metrics', icon: BarChart3,      label: 'Métricas' },
  { to: '/logs',    icon: ScrollText,     label: 'Logs'     },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-surface border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-wide">MainFJ</div>
          <div className="text-[10px] text-slate-500 tracking-widest uppercase">Dashboard</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <div className="text-[10px] text-slate-600 tracking-widest uppercase">FJ · v0.1.0</div>
      </div>
    </aside>
  )
}
