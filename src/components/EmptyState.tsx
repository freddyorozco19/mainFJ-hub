import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-border flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate-600" />
      </div>
      <h3 className="text-sm font-medium text-slate-400 mb-1">{title}</h3>
      {description && <p className="text-xs text-slate-600 max-w-xs">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-xs bg-primary/15 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
