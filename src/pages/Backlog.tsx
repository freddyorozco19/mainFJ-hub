import { useState, useEffect } from 'react'
import {
  Plus, Loader2, Search, Trash2, Edit3, CheckCircle2,
  Circle, ChevronDown, ChevronUp, Calendar, Flag, Tag,
  Layers, List, Columns3, GripVertical, Eye, ArrowRight,
} from 'lucide-react'
import { api } from '../api'

type Status = 'backlog' | 'in_progress' | 'review' | 'done'
type Priority = 'low' | 'medium' | 'high' | 'critical'

interface Subtask {
  id: number; task_id: number; title: string; done: boolean
}
interface Task {
  id: number; title: string; description: string; status: Status
  priority: Priority; project: string; sprint: string; tags: string
  due_date: string; created_at: string; updated_at: string; subtasks: Subtask[]
}

const DEFAULT_PROJECTS = ['WinStats', 'ArchiTechIA', 'GrowData', 'Academy', 'Finance', 'Hogar']

const STATUS_LABELS: Record<Status, string> = { backlog: 'Backlog', in_progress: 'En Progreso', review: 'Review', done: 'Hecho' }
const STATUS_COLORS: Record<Status, string> = { backlog: 'bg-slate-600', in_progress: 'bg-blue-500', review: 'bg-purple-500', done: 'bg-emerald-500' }
const PRIORITY_COLORS: Record<Priority, string> = { low: 'text-slate-400', medium: 'text-yellow-400', high: 'text-orange-400', critical: 'text-red-400' }

export function Backlog() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [sprints, setSprints] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])

  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterSprint, setFilterSprint] = useState('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewTask, setViewTask] = useState<Task | null>(null)
  const [viewTab, setViewTab] = useState<'info' | 'subtasks' | 'history'>('info')
  const [form, setForm] = useState({ title: '', description: '', status: 'backlog' as Status, priority: 'medium' as Priority, project: '', sprint: '', tags: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())
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
      setTasks(await (await api('/backlog/tasks?' + params)).json())
    } catch { } finally { setLoading(false) }
  }
  async function loadSprints() { try { setSprints(await (await api('/backlog/sprints')).json()) } catch {} }
  async function loadProjects() { try { setProjects(await (await api('/backlog/projects')).json()) } catch {} }

  function openCreate() { setEditingTask(null); setForm({ title: '', description: '', status: 'backlog', priority: 'medium', project: '', sprint: filterSprint, tags: '', due_date: '' }); setShowModal(true) }
  function openEdit(task: Task) { setEditingTask(task); setForm({ title: task.title, description: task.description, status: task.status, priority: task.priority, project: task.project, sprint: task.sprint, tags: task.tags, due_date: task.due_date }); setShowModal(true) }

  async function handleSave() {
    if (!form.title.trim()) return; setSaving(true)
    try {
      if (editingTask) await api('/backlog/tasks/' + editingTask.id, { method: 'PUT', body: form })
      else await api('/backlog/tasks', { method: 'POST', body: form })
      setShowModal(false); loadTasks(); loadSprints(); loadProjects()
    } catch (e: any) { alert('Error: ' + (e.message || 'Desconocido')) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number) { await api('/backlog/tasks/' + id, { method: 'DELETE' }); loadTasks() }
  async function handleStatusChange(task: Task, newStatus: Status) { await api('/backlog/tasks/' + task.id, { method: 'PUT', body: { status: newStatus } }); loadTasks() }

  async function addSubtask(taskId: number) {
    const title = newSubtask[taskId]?.trim(); if (!title) return
    await api('/backlog/tasks/' + taskId + '/subtasks', { method: 'POST', body: { title } })
    setNewSubtask(p => ({ ...p, [taskId]: '' })); loadTasks()
  }
  async function toggleSubtask(sub: Subtask) { await api('/backlog/subtasks/' + sub.id, { method: 'PUT', body: { done: !sub.done } }); loadTasks() }
  async function deleteSubtask(id: number) { await api('/backlog/subtasks/' + id, { method: 'DELETE' }); loadTasks() }

  const subtaskProgress = (t: Task) => t.subtasks.length === 0 ? 0 : Math.round((t.subtasks.filter(s => s.done).length / t.subtasks.length) * 100)
  const groupedForKanban = () => { const g: Record<Status, Task[]> = { backlog: [], in_progress: [], review: [], done: [] }; tasks.forEach(t => g[t.status].push(t)); return g }
  const statusColor = (s: Status) => ({ backlog: 'bg-slate-500/20 text-slate-400', in_progress: 'bg-blue-500/20 text-blue-400', review: 'bg-purple-500/20 text-purple-400', done: 'bg-emerald-500/20 text-emerald-400' }[s])
  const allProjects = [...new Set([...DEFAULT_PROJECTS, ...projects])]

  return (
    <div className="flex-1 p-6 space-y-4 overflow-auto max-w-[1400px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Backlog</h1><p className="text-sm text-slate-500 mt-1">{tasks.length} tareas</p></div>
        <div className="flex items-center gap-2">
          <div className="flex bg-card border border-border rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={'px-3 py-1.5 rounded text-xs ' + (viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-white')}><List size={14} /></button>
            <button onClick={() => setViewMode('kanban')} className={'px-3 py-1.5 rounded text-xs ' + (viewMode === 'kanban' ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-white')}><Columns3 size={14} /></button>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-lg"><Plus size={15} /> Nueva Tarea</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-surface border border-border text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50">
          <option value="">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="bg-surface border border-border text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50">
          <option value="">Todas las prioridades</option><option value="critical">Critica</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option>
        </select>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-surface border border-border text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50">
          <option value="">Todos los proyectos</option>{allProjects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterSprint} onChange={e => setFilterSprint(e.target.value)} className="bg-surface border border-border text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50">
          <option value="">Todos los sprints</option>{sprints.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center py-20 gap-2 text-slate-500"><Loader2 size={18} className="animate-spin" /><span className="text-sm">Cargando...</span></div>}

      {!loading && viewMode === 'list' && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-2"><Layers size={32} /><span className="text-sm">Sin tareas</span></div>
          ) : tasks.map(task => (
            <div key={task.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/20 transition-colors cursor-pointer" onClick={() => { setViewTask(task); setViewTab('info') }}>
              <div className="flex items-center gap-3 p-4">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[task.status]}`} />
                <span className={`text-xs ${PRIORITY_COLORS[task.priority]}`}><Flag size={12} /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {task.project && <span className="text-[10px] text-primary flex items-center gap-1"><Layers size={10} />{task.project}</span>}
                    {task.sprint && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar size={10} />{task.sprint}</span>}
                    {task.due_date && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar size={10} />{task.due_date}</span>}
                    {task.subtasks.length > 0 && <span className="text-[10px] text-slate-500">{subtaskProgress(task)}%</span>}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor(task.status)}`}>{STATUS_LABELS[task.status]}</span>
                <Eye size={14} className="text-slate-600" />
              </div>
            </div>
          ))}
        </div>
      )}

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
                <div key={task.id} draggable onDragStart={e => e.dataTransfer.setData('taskId', String(task.id))} onDragOver={e => e.preventDefault()}
                  onDrop={async e => { e.preventDefault(); const id = parseInt(e.dataTransfer.getData('taskId')); if (id && status !== tasks.find(t => t.id === id)?.status) { await handleStatusChange(task, status) } }}
                  className="bg-surface border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => { setViewTask(task); setViewTab('info') }}>
                  <div className="flex items-start gap-2">
                    <GripVertical size={12} className="text-slate-700 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] ${PRIORITY_COLORS[task.priority]}`}><Flag size={10} /></span>
                        {task.project && <span className="text-[10px] text-primary">{task.project}</span>}
                        {task.sprint && <span className="text-[10px] text-slate-600">{task.sprint}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {viewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewTask(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[viewTask.status]}`} />
                <div>
                  <h2 className="text-lg font-bold text-white">{viewTask.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {viewTask.project && <span className="text-[10px] text-primary flex items-center gap-1"><Layers size={10} />{viewTask.project}</span>}
                    {viewTask.sprint && <span className="text-[10px] text-slate-500">{viewTask.sprint}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[viewTask.priority]}`}><Flag size={10} /> {viewTask.priority}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setViewTask(null); setTimeout(() => openEdit(viewTask!), 100) }} className="p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg" title="Editar"><Edit3 size={15} /></button>
                <button onClick={() => { if (confirm('Eliminar esta tarea?')) { handleDelete(viewTask.id); setViewTask(null) } }} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="Eliminar"><Trash2 size={15} /></button>
                <button onClick={() => setViewTask(null)} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg text-lg">&times;</button>
              </div>
            </div>

            <div className="flex gap-0 px-5 pt-4 border-b border-border">
              {(['info', 'subtasks', 'history'] as const).map(tab => (
                <button key={tab} onClick={() => setViewTab(tab)} className={'px-4 py-2 text-xs font-medium border-b-2 transition-colors ' + (viewTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-300')}>{tab === 'info' ? 'Info' : tab === 'subtasks' ? 'Subtareas' : 'Avance'}</button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {viewTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-[10px] text-slate-500 uppercase tracking-wider">Estado</span><select value={viewTask.status} onChange={e => { handleStatusChange(viewTask, e.target.value as Status); setViewTask(t => t ? { ...t, status: e.target.value as Status } : null) }} className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-slate-300 mt-1 focus:outline-none focus:border-primary/50">{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                    <div><span className="text-[10px] text-slate-500 uppercase tracking-wider">Prioridad</span><p className="text-xs text-white mt-1">{viewTask.priority}</p></div>
                    <div><span className="text-[10px] text-slate-500 uppercase tracking-wider">Proyecto</span><p className="text-xs text-white mt-1">{viewTask.project || '-'}</p></div>
                    <div><span className="text-[10px] text-slate-500 uppercase tracking-wider">Sprint</span><p className="text-xs text-white mt-1">{viewTask.sprint || '-'}</p></div>
                    <div><span className="text-[10px] text-slate-500 uppercase tracking-wider">Fecha limite</span><p className="text-xs text-white mt-1">{viewTask.due_date || '-'}</p></div>
                    <div><span className="text-[10px] text-slate-500 uppercase tracking-wider">Tags</span><p className="text-xs text-white mt-1">{viewTask.tags || '-'}</p></div>
                  </div>
                  {viewTask.description && <div><span className="text-[10px] text-slate-500 uppercase tracking-wider">Descripcion</span><p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap">{viewTask.description}</p></div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-[10px] text-slate-500 uppercase tracking-wider">Creado</span><p className="text-xs text-slate-500 mt-1">{new Date(viewTask.created_at).toLocaleDateString()}</p></div>
                    <div><span className="text-[10px] text-slate-500 uppercase tracking-wider">Actualizado</span><p className="text-xs text-slate-500 mt-1">{new Date(viewTask.updated_at).toLocaleDateString()}</p></div>
                  </div>
                </div>
              )}

              {viewTab === 'subtasks' && (
                <div className="space-y-2">
                  {viewTask.subtasks.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-slate-500">Progreso</span>
                        <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: subtaskProgress(viewTask) + '%' }} /></div>
                        <span className="text-[10px] text-slate-400">{subtaskProgress(viewTask)}%</span>
                      </div>
                    </div>
                  )}
                  {viewTask.subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 group">
                      <button onClick={() => toggleSubtask(sub)} className="text-slate-500 hover:text-emerald-400">{sub.done ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Circle size={14} />}</button>
                      <span className={'text-xs flex-1 ' + (sub.done ? 'text-slate-600 line-through' : 'text-slate-300')}>{sub.title}</span>
                      <button onClick={() => deleteSubtask(sub.id)} className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={11} /></button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-3">
                    <Circle size={14} className="text-slate-600" />
                    <input value={newSubtask[viewTask.id] || ''} onChange={e => setNewSubtask(p => ({ ...p, [viewTask.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addSubtask(viewTask.id) }} placeholder="+ Agregar subtarea..." className="flex-1 bg-transparent text-xs text-slate-400 placeholder-slate-700 focus:outline-none focus:text-white" />
                  </div>
                </div>
              )}

              {viewTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {(['backlog', 'in_progress', 'review', 'done'] as Status[]).map((s, i) => (
                      <div key={s} className="flex items-center gap-2 flex-1">
                        <div className={'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ' + (viewTask.status === s ? 'bg-primary text-white' : i === 0 ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-600')}>{i + 1}</div>
                        <div className="flex-1"><p className={'text-[10px] font-medium ' + (viewTask.status === s ? 'text-white' : 'text-slate-600')}>{STATUS_LABELS[s]}</p></div>
                        {i < 3 && <ArrowRight size={12} className="text-slate-700 shrink-0" />}
                      </div>
                    ))}
                  </div>
                  <div className="bg-surface border border-border rounded-lg p-3">
                    <p className="text-xs text-slate-400">Estado actual: <span className="text-white">{STATUS_LABELS[viewTask.status]}</span></p>
                    <p className="text-xs text-slate-500 mt-2">Cambia el estado usando el selector en la pestana Info.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Titulo</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" placeholder="Titulo de la tarea" autoFocus /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Descripcion</label><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 resize-none" placeholder="Detalles..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Estado</label><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-primary/50">{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Prioridad</label><select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-primary/50"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Critica</option></select></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Proyecto</label><select value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-primary/50"><option value="">Seleccionar...</option>{allProjects.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Sprint</label><input value={form.sprint} onChange={e => setForm(p => ({ ...p, sprint: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" placeholder="ej: Sprint 1" list="sprint-list" /><datalist id="sprint-list">{sprints.map(s => <option key={s} value={s} />)}</datalist></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Fecha limite</label><input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Tags</label><input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" placeholder="frontend, bug, urgent" /></div>
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-border">
              <button onClick={() => setShowModal(false)} disabled={saving} className="flex-1 py-2 text-sm text-slate-400 hover:text-white border border-border rounded-lg hover:bg-white/5 disabled:opacity-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium disabled:opacity-50">{saving ? 'Guardando...' : editingTask ? 'Guardar Cambios' : 'Crear Tarea'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}