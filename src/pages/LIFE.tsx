import { Heart, Activity, Droplets, Moon, Brain, TrendingUp, Target, Flame, Coffee, Dumbbell, BookOpen } from 'lucide-react'

export function LIFE() {
  const habits = [
    { name: 'Ejercicio', icon: Dumbbell, current: 5, target: 6, color: 'primary', unit: 'días' },
    { name: 'Lectura', icon: BookOpen, current: 45, target: 60, color: 'accent', unit: 'min' },
    { name: 'Agua', icon: Droplets, current: 6, target: 8, color: 'success', unit: 'vasos' },
    { name: 'Sueño', icon: Moon, current: 7, target: 8, color: 'warning', unit: 'horas' },
  ]

  const wellness = [
    { label: 'Racha Actual', value: '23 días', icon: Flame, color: 'text-orange-400' },
    { label: 'Meta Diaria', value: '85%', icon: Target, color: 'text-primary' },
    { label: 'Bienestar', value: '78/100', icon: Heart, color: 'text-danger' },
    { label: 'Productividad', value: '92%', icon: TrendingUp, color: 'text-success' },
  ]

  const tasks = [
    { task: 'Meditación matutina', time: '7:00 AM', completed: true },
    { task: 'Ejercicio', time: '6:30 PM', completed: false },
    { task: 'Lectura', time: '9:00 PM', completed: false },
    { task: 'Planificar día siguiente', time: '10:00 PM', completed: false },
  ]

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">LIFE</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de hábitos y bienestar personal</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-success bg-success/15 px-3 py-1.5 rounded-full border border-success/30">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Racha: 23 días
        </div>
      </div>

      {/* Wellness Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {wellness.map((item, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <item.icon size={18} className={item.color} />
            </div>
            <p className="text-2xl font-bold text-white">{item.value}</p>
            <p className="text-xs text-slate-500 mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Daily Habits */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Hábitos del Día</h3>
          <span className="text-xs text-slate-500">Miércoles, 8 de Abril</span>
        </div>
        <div className="space-y-4">
          {habits.map((habit, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl bg-${habit.color}/15 flex items-center justify-center`}>
                <habit.icon size={18} className={`text-${habit.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{habit.name}</span>
                  <span className="text-xs text-slate-500">{habit.current}/{habit.target} {habit.unit}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-${habit.color} rounded-full transition-all`}
                    style={{ width: `${(habit.current / habit.target) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Tareas del Día</h3>
        <div className="space-y-3">
          {tasks.map((task, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${task.completed ? 'bg-success/5 border-success/20' : 'bg-surface border-border'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                task.completed ? 'bg-success/20 text-success' : 'border border-slate-600'
              }`}>
                {task.completed && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <span className={`text-sm ${task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {task.task}
                </span>
              </div>
              <span className="text-xs text-slate-500">{task.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <button className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-primary/40 transition-colors">
            <Activity size={18} className="text-primary" />
            <span className="text-sm text-slate-300">Registrar Ejercicio</span>
          </button>
          <button className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-primary/40 transition-colors">
            <Droplets size={18} className="text-primary" />
            <span className="text-sm text-slate-300">Registrar Agua</span>
          </button>
          <button className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-primary/40 transition-colors">
            <Brain size={18} className="text-primary" />
            <span className="text-sm text-slate-300">Meditación</span>
          </button>
          <button className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-primary/40 transition-colors">
            <Coffee size={18} className="text-primary" />
            <span className="text-sm text-slate-300">Nuevo Hábito</span>
          </button>
        </div>
      </div>
    </div>
  )
}
