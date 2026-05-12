import { useState, useEffect } from 'react'
import {
  Plus, Loader2, Search, Trash2, Edit3, CheckCircle2,
  Circle, ChevronDown, ChevronUp, Calendar, Flag, Tag,
  Layers, List, Columns3, GripVertical,
} from 'lucide-react'
import { api } from '../api'

type Status = 'backlog' | 'in_progress' | 'review' | 'done'
type Priority = 'low' | 'medium' | 'high' | 'critical'

interface Subtask {
  id: number
  task_id: number
  title: string
  done: boolean
}

interface Task {
  id: number
  title: string
  description: string
  status: Status
  priority: Priority
  project: string
  sprint: string
  tags: string
  due_date: string
  created_at: string
  updated_at: string
  subtasks: Subtask[]
}

const STATUS_LABELS: Record<Status, string> = {
  backlog: 'Backlog',
  in_progress: 'En Progreso',
  review: 'Review',
  done: 'Hecho',
}

const STATUS_COLORS: Record<Status, string> = {
  backlog: 'bg-slate-600',
  in_progress: 'bg-blue-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'text-slate-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
}


export function Backlog() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [sprints, setSprints] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterSprint, setFilterSprint] = useState('')
  const [search, setSearch] = useState('')

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  // Task modal
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', status: 'backlog' as Status,
    priority: 'medium' as Priority, project: '', sprint: '', tags: '', due_date: ''
  })
  const [saving, setSaving] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())

  // Subtask input per expanded task
  const [newSubtask, setNewSubtask] = useState<Record<number, string>>({})

  useEffect(() => { loadTasks(); loadSprints(); loadProjects() }, [filterStatus, filterPriority, filterProject, filterSprint, search])

  async function loadTasks() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterPriority) params.set('priority', filterPriority)
      if (filterProject) params.set('project', filterProject)
      if (filterSprint) params.set('sprint', filterSprint)
      if (search) params.set('search', search)
      const res = await api(`/backlog/tasks?${params}`)
      setTasks(await res.json())
    } catch { /* offline */ }
    finally { setLoading(false) }
  }

  async function loadSprints() {
    try {
      const res = await api('/backlog/sprints')
      setSprints(await res.json())
    } catch {}
  }

  async function loadProjects() {
    try {
      const res = await api('/backlog/projects')
      setProjects(await res.json())
    } catch {}
  }

  function openCreate() {
    setEditingTask(null)
    setForm({ title: '', description: '', status: 'backlog', priority: 'medium', sprint: filterSprint, tags: '', due_date: '' })
    setShowModal(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setForm({
      title: task.title, description: task.description,
      status: task.status, priority: task.priority,
      project: task.project, sprint: task.sprint, tags: task.tags, due_date: task.due_date
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (editingTask) {
        await api(`/backlog/tasks/${editingTask.id}`, { method: 'PUT', body: form })
      } else {
        await api('/backlog/tasks', { method: 'POST', body: form })
      }
      setShowModal(false)
      loadTasks()
      loadSprints()
    } catch (e: any) {
      alert('Error: ' + (e.message || 'Desconocido'))
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Eliminar esta tarea?')) return
    await api(`/backlog/tasks/${id}`, { method: 'DELETE' })
    loadTasks()
  }

  async function handleStatusChange(task: Task, newStatus: Status) {
    await api(`/backlog/tasks/${task.id}`, { method: 'PUT', body: { status: newStatus } })
    loadTasks()
  }

  async function addSubtask(taskId: number) {
    const title = newSubtask[taskId]?.trim()
    if (!title) return
    await api(`/backlog/tasks/${taskId}/subtasks`, { method: 'POST', body: { title } })
    setNewSubtask(prev => ({ ...prev, [taskId]: '' }))
    loadTasks()
  }

  async function toggleSubtask(sub: Subtask) {
    await api(`/backlog/subtasks/${sub.id}`, { method: 'PUT', body: { done: !sub.done } })
    loadTasks()
  }

  async function deleteSubtask(id: number) {
    await api(`/backlog/subtasks/${id}`, { method: 'DELETE' })
    loadTasks()
  }

  function toggleExpand(id: number) {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const subtaskProgress = (task: Task) => {
    if (task.subtasks.length === 0) return 0
    const done = task.subtasks.filter(s => s.done).length
    return Math.round((done / task.subtasks.length) * 100)
  }

  const groupedForKanban = () => {
    const groups: Record<Status, Task[]> = { backlog: [], in_progress: [], review: [], done: [] }
    tasks.forEach(t => groups[t.status].push(t))
    return groups
  }

  return (
    <div className="flex-1 p-6 space-y-4 overflow-auto max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Backlog</h1>
          <p className="text-sm text-slate-500 mt-1">{tasks.length} tareas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-card border border-border rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded text-xs ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-white'}`}><List size={14} /></button>
            <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 rounded text-xs ${viewMode === 'kanban' ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-white'}`}><Columns3 size={14} /></button>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={15} /> Nueva Tarea
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-surface border border-border text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="bg-surface border border-border text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50">
          <option value="">Todas las prioridades</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
        <select value={filterSprint} onChange={e => setFilterSprint(e.target.value)} className="bg-surface border border-border text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50">
          <option value="">Todos los sprints</option>
          {sprints.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-2 text-slate-500"><Loader2 size={18} className="animate-spin" /><span className="text-sm">Cargando...</span></div>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-2"><Layers size={32} /><span className="text-sm">Sin tareas</span></div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {/* Status badge */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[task.status]}`} />
                  
                  {/* Priority flag */}
                  <span className={`text-xs ${PRIORITY_COLORS[task.priority]}`}><Flag size={12} /></span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleExpand(task.id)} className="text-slate-400 hover:text-white">
                        {expandedTasks.has(task.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <span className={`text-sm font-medium ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">{STATUS_LABELS[task.status]}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-6">
                      {task.project && <span className="text-[10px] text-primary flex items-center gap-1"><Layers size={10} />{task.project}</span>}
                      {task.sprint && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar size={10} />{task.sprint}</span>}
                      {task.due_date && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar size={10} />{task.due_date}</span>}
                      {task.tags && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Tag size={10} />{task.tags}</span>}
                      {task.subtasks.length > 0 && (
                        <span className="text-[10px] text-slate-500">{subtaskProgress(task)}%</span>
                      )}
                    </div>
                  </div>

                  {/* Quick status change */}
                  <select value={task.status} onChange={e => handleStatusChange(task, e.target.value as Status)} className="bg-surface border border-border text-[10px] text-slate-300 rounded px-2 py-1 focus:outline-none">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>

                  {/* Actions */}
                  <button onClick={() => openEdit(task)} className="text-slate-500 hover:text-accent"><Edit3 size={13} /></button>
                  <button onClick={() => handleDelete(task.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={13} /></button>
                </div>

                {/* Expanded: description + subtasks */}
                {expandedTasks.has(task.id) && (
                  <div className="border-t border-border px-4 py-3 space-y-3 bg-white/[0.01]">
                    {task.description && <p className="text-xs text-slate-400 whitespace-pre-wrap">{task.description}</p>}
                    
                    {/* Subtasks */}
                    <div className="space-y-1">
                      {task.subtasks.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 group">
                          <button onClick={() => toggleSubtask(sub)} className="text-slate-500 hover:text-emerald-400">
                            {sub.done ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Circle size={13} />}
                          </button>
                          <span className={`text-xs flex-1 ${sub.done ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{sub.title}</span>
                          <button onClick={() => deleteSubtask(sub.id)} className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={11} /></button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-2">
                        <Circle size={13} className="text-slate-600" />
                        <input
                          value={newSubtask[task.id] || ''}
                          onChange={e => setNewSubtask(prev => ({ ...prev, [task.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addSubtask(task.id) }}
                          placeholder="+ Agregar subtarea..."
                          className="flex-1 bg-transparent text-xs text-slate-400 placeholder-slate-700 focus:outline-none focus:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Kanban View */}
      {!loading && viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.entries(groupedForKanban()) as [Status, Task[]][]).map(([status, items]) => (
            <div key={status} className="bg-card border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
                <span className="text-xs font-semibold text-white">{STATUS_LABELS[status]}</span>
                <span className="text-[10px] text-slate-600">{items.length}</span>
              </div>
              {items.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('taskId', String(task.id))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault()
                    const id = parseInt(e.dataTransfer.getData('taskId'))
                    if (id && status !== tasks.find(t => t.id === id)?.status) {
                      await handleStatusChange(task, status)
                    }
                  }}
                  className="bg-surface border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => openEdit(task)}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={12} className="text-slate-700 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] ${PRIORITY_COLORS[task.priority]}`}><Flag size={10} /></span>
                        {task.project && <span className="text-[10px] text-primary">{task.project}</span>}
                        {task.sprint && <span className="text-[10px] text-slate-600">{task.sprint}</span>}
                        {task.due_date && <span className="text-[10px] text-slate-600 flex items-center gap-1"><Calendar size={9} />{task.due_date}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Título</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" placeholder="Título de la tarea" autoFocus />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Descripción</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 resize-none" placeholder="Detalles..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Estado</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-primary/50">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Prioridad</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-primary/50">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Proyecto</label>`n                <input value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" placeholder="WinStats, ArchiTechIA, Hogar..." list="project-list" />`n                <datalist id="project-list">{projects.map(p => <option key={p} value={p} />)}</datalist>`n              </div>`n              <div>`n                <label className="text-xs text-slate-400 mb-1 block">Sprint</label>
                  <input value={form.sprint} onChange={e => setForm(p => ({ ...p, sprint: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" placeholder="ej: Sprint 1" list="sprint-list" />
                  <datalist id="sprint-list">{sprints.map(s => <option key={s} value={s} />)}</datalist>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Fecha límite</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tags (separados por coma)</label>
                <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" placeholder="frontend, bug, urgent" />
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-border">
              <button onClick={() => setShowModal(false)} disabled={saving} className="flex-1 py-2 text-sm text-slate-400 hover:text-white border border-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                {saving ? 'Guardando...' : (editingTask ? 'Guardar Cambios' : 'Crear Tarea')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}