import { useState, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, Loader2, X, ExternalLink,
  CreditCard, Calendar, RefreshCw, TrendingUp,
} from 'lucide-react'
import { api } from '../api'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Sub {
  NOMBRE: string
  DESCRIPCION: string
  PRECIO: string | number
  MONEDA: string
  CICLO: string
  DIA_COBRO: string | number
  FECHA_INICIO: string
  ESTADO: string
  TARJETA: string
  CATEGORIA: string
  URL: string
  _index: number
}

const CATEGORIAS: Record<string, { label: string; color: string }> = {
  entretenimiento: { label: 'Entretenimiento', color: '#A855F7' },
  trabajo:         { label: 'Trabajo',          color: '#3B82F6' },
  herramientas:    { label: 'Herramientas',     color: '#06B6D4' },
  salud:           { label: 'Salud',            color: '#10B981' },
  educacion:       { label: 'Educación',        color: '#F59E0B' },
  otros:           { label: 'Otros',            color: '#6B7280' },
}

const CICLOS: Record<string, { label: string; factor: number }> = {
  mensual:     { label: 'Mensual',     factor: 1      },
  anual:       { label: 'Anual',       factor: 1 / 12 },
  trimestral:  { label: 'Trimestral', factor: 1 / 3  },
  semanal:     { label: 'Semanal',    factor: 4.33   },
}

const ESTADOS = ['activa', 'inactiva', 'cancelada']
const MONEDAS = ['COP', 'USD', 'EUR']

const USD_COP = 4250
const EUR_COP = 4650

// ── Helpers ──────────────────────────────────────────────────────────────────

function toCOP(precio: number, moneda: string, ciclo: string): number {
  const factor = CICLOS[ciclo]?.factor ?? 1
  const mensual = precio * factor
  if (moneda === 'USD') return mensual * USD_COP
  if (moneda === 'EUR') return mensual * EUR_COP
  return mensual
}

function nextBillingDate(dia: number): { date: Date; days: number } | null {
  if (!dia || isNaN(dia)) return null
  const today = new Date()
  let candidate = new Date(today.getFullYear(), today.getMonth(), dia)
  if (candidate <= today) {
    candidate = new Date(today.getFullYear(), today.getMonth() + 1, dia)
  }
  const days = Math.ceil((candidate.getTime() - today.getTime()) / 86400000)
  return { date: candidate, days }
}

function formatPrice(precio: number, moneda: string): string {
  if (moneda === 'COP') {
    if (precio >= 1_000_000) return `$${(precio / 1_000_000).toFixed(1)}M`
    if (precio >= 1_000)     return `$${(precio / 1_000).toFixed(0)}K`
    return `$${precio}`
  }
  return `${moneda} ${precio.toLocaleString()}`
}

const MONTH_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

const EMPTY_FORM = {
  NOMBRE: '', DESCRIPCION: '', PRECIO: '', MONEDA: 'COP', CICLO: 'mensual',
  DIA_COBRO: '', FECHA_INICIO: '', ESTADO: 'activa', TARJETA: '', CATEGORIA: 'entretenimiento', URL: '',
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FinanceSuscripciones() {
  const [subs, setSubs]         = useState<Sub[]>([])
  const [loading, setLoading]   = useState(false)
  const [modal, setModal]       = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Sub | null>(null)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [filterEstado, setFilterEstado] = useState<string>('todas')
  const [filterCat, setFilterCat]       = useState<string>('todas')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api('/finance/data/suscripciones')
      if (res.ok) {
        const data = await res.json()
        const rows: Sub[] = (data.records || []).map((r: any, i: number) => ({ ...r, _index: i }))
        setSubs(rows)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setEditTarget(null)
    setModal('add')
  }

  function openEdit(sub: Sub) {
    setForm({
      NOMBRE:       sub.NOMBRE       || '',
      DESCRIPCION:  sub.DESCRIPCION  || '',
      PRECIO:       String(sub.PRECIO || ''),
      MONEDA:       sub.MONEDA       || 'COP',
      CICLO:        sub.CICLO        || 'mensual',
      DIA_COBRO:    String(sub.DIA_COBRO || ''),
      FECHA_INICIO: sub.FECHA_INICIO || '',
      ESTADO:       sub.ESTADO       || 'activa',
      TARJETA:      sub.TARJETA      || '',
      CATEGORIA:    sub.CATEGORIA    || 'entretenimiento',
      URL:          sub.URL          || '',
    })
    setEditTarget(sub)
    setModal('edit')
  }

  async function save() {
    if (!form.NOMBRE.trim()) return
    setSaving(true)
    try {
      const data = {
        ...form,
        PRECIO: parseFloat(String(form.PRECIO).replace(/,/g, '.')) || 0,
        DIA_COBRO: parseInt(String(form.DIA_COBRO)) || 0,
      }
      if (modal === 'add') {
        await api('/finance/records', { method: 'POST', body: JSON.stringify({ tab: 'suscripciones', data }) })
      } else if (editTarget !== undefined && editTarget !== null) {
        await api('/finance/records', { method: 'PUT', body: JSON.stringify({ tab: 'suscripciones', row_index: editTarget._index, data }) })
      }
      setModal(null)
      await load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function deleteSub(sub: Sub) {
    if (!confirm(`¿Eliminar "${sub.NOMBRE}"?`)) return
    setDeleting(sub._index)
    try {
      await api('/finance/records', { method: 'DELETE', body: JSON.stringify({ tab: 'suscripciones', row_index: sub._index }) })
      await load()
    } catch { /* ignore */ }
    setDeleting(null)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const activas = subs.filter(s => (s.ESTADO || '').toLowerCase() === 'activa')

  const totalMensualCOP = activas.reduce((acc, s) => {
    const precio = parseFloat(String(s.PRECIO)) || 0
    return acc + toCOP(precio, s.MONEDA || 'COP', s.CICLO || 'mensual')
  }, 0)

  const filtered = subs.filter(s => {
    if (filterEstado !== 'todas' && (s.ESTADO || '').toLowerCase() !== filterEstado) return false
    if (filterCat !== 'todas' && (s.CATEGORIA || '').toLowerCase() !== filterCat) return false
    return true
  })

  // Ordenar: activas primero, luego por dia de cobro próximo
  const sorted = [...filtered].sort((a, b) => {
    const ea = (a.ESTADO || '').toLowerCase() === 'activa' ? 0 : 1
    const eb = (b.ESTADO || '').toLowerCase() === 'activa' ? 0 : 1
    if (ea !== eb) return ea - eb
    return (parseInt(String(a.DIA_COBRO)) || 31) - (parseInt(String(b.DIA_COBRO)) || 31)
  })

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Suscripciones</h3>
          <p className="text-xs text-slate-500 mt-0.5">Gestión de servicios recurrentes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-card border border-border rounded-lg transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/80 text-white text-xs font-medium rounded-lg transition-colors">
            <Plus size={13} />
            Nueva suscripción
          </button>
        </div>
      </div>

      {/* ── Summary ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={13} className="text-primary" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Total mensual</span>
          </div>
          <p className="text-lg font-bold text-white">
            {totalMensualCOP >= 1_000_000
              ? `$${(totalMensualCOP / 1_000_000).toFixed(2)}M`
              : `$${Math.round(totalMensualCOP).toLocaleString('es-CO')}`}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">COP aproximado</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={13} className="text-emerald-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Total anual</span>
          </div>
          <p className="text-lg font-bold text-white">
            {(totalMensualCOP * 12) >= 1_000_000
              ? `$${((totalMensualCOP * 12) / 1_000_000).toFixed(2)}M`
              : `$${Math.round(totalMensualCOP * 12).toLocaleString('es-CO')}`}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">COP aproximado</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={13} className="text-blue-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Activas</span>
          </div>
          <p className="text-lg font-bold text-white">{activas.length}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">de {subs.length} totales</p>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Estado */}
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          {['todas', 'activa', 'inactiva', 'cancelada'].map(e => (
            <button key={e} onClick={() => setFilterEstado(e)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                filterEstado === e
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              {e.charAt(0).toUpperCase() + e.slice(1)}
            </button>
          ))}
        </div>
        {/* Categoría */}
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1 flex-wrap">
          <button onClick={() => setFilterCat('todas')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              filterCat === 'todas' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}>Todas</button>
          {Object.entries(CATEGORIAS).map(([key, { label, color }]) => (
            <button key={key} onClick={() => setFilterCat(key)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
              style={filterCat === key
                ? { backgroundColor: color + '25', color, border: `1px solid ${color}40` }
                : { color: '#6B7280' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de tarjetas ────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-36 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <p className="text-slate-500 text-sm">No hay suscripciones{filterEstado !== 'todas' || filterCat !== 'todas' ? ' con este filtro' : ''}.</p>
          {filterEstado === 'todas' && filterCat === 'todas' && (
            <button onClick={openAdd} className="mt-3 text-xs text-primary hover:underline">+ Agregar la primera</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sorted.map(sub => {
            const cat = CATEGORIAS[sub.CATEGORIA?.toLowerCase()] ?? CATEGORIAS.otros
            const precio = parseFloat(String(sub.PRECIO)) || 0
            const estado = (sub.ESTADO || 'activa').toLowerCase()
            const dia = parseInt(String(sub.DIA_COBRO)) || 0
            const next = nextBillingDate(dia)
            const cicloLabel = CICLOS[sub.CICLO?.toLowerCase()]?.label || sub.CICLO || ''
            const mensualCOP = toCOP(precio, sub.MONEDA || 'COP', sub.CICLO || 'mensual')

            const statusColor = estado === 'activa' ? '#10B981' : estado === 'inactiva' ? '#F59E0B' : '#EF4444'
            const isDimmed = estado !== 'activa'

            return (
              <div key={sub._index}
                className={`relative bg-card border rounded-xl p-4 transition-all group ${isDimmed ? 'opacity-60' : 'hover:border-white/10'}`}
                style={{ borderColor: isDimmed ? '' : cat.color + '30' }}>

                {/* Barra superior de color */}
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: isDimmed ? '#374151' : cat.color }} />

                {/* Header: avatar + nombre + acciones */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: cat.color + '30', border: `1px solid ${cat.color}50`, color: cat.color }}>
                      {sub.NOMBRE.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{sub.NOMBRE}</p>
                      {sub.DESCRIPCION && (
                        <p className="text-[10px] text-slate-500 truncate">{sub.DESCRIPCION}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {sub.URL && (
                      <a href={sub.URL} target="_blank" rel="noopener noreferrer"
                        className="p-1 text-slate-500 hover:text-slate-200 rounded">
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <button onClick={() => openEdit(sub)} className="p-1 text-slate-500 hover:text-blue-400 rounded">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => deleteSub(sub)} disabled={deleting === sub._index}
                      className="p-1 text-slate-500 hover:text-red-400 rounded">
                      {deleting === sub._index ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>

                {/* Precio */}
                <div className="mb-3">
                  <p className="text-base font-bold" style={{ color: isDimmed ? '#6B7280' : cat.color }}>
                    {formatPrice(precio, sub.MONEDA || 'COP')}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {cicloLabel}
                    {sub.MONEDA !== 'COP' && mensualCOP > 0 && (
                      <span className="ml-1 text-slate-700">
                        · ~${Math.round(mensualCOP / 1000)}K/mes
                      </span>
                    )}
                  </p>
                </div>

                {/* Footer: badges */}
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1">
                    {/* Estado */}
                    <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: statusColor + '20', color: statusColor }}>
                      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: statusColor }} />
                      {estado}
                    </span>
                    {/* Categoría */}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: cat.color + '15', color: cat.color }}>
                      {cat.label}
                    </span>
                  </div>
                  {/* Próximo cobro */}
                  {next && estado === 'activa' && (
                    <span className={`text-[10px] font-medium ${
                      next.days <= 3 ? 'text-red-400' : next.days <= 7 ? 'text-amber-400' : 'text-slate-500'
                    }`}>
                      {next.date.getDate()} {MONTH_ES[next.date.getMonth()]} · {next.days}d
                    </span>
                  )}
                </div>

                {/* Tarjeta */}
                {sub.TARJETA && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1">
                    <CreditCard size={9} className="text-slate-600" />
                    <span className="text-[10px] text-slate-600 truncate">{sub.TARJETA}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Add/Edit ───────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F1117] border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-sm font-semibold text-white">
                {modal === 'add' ? 'Nueva suscripción' : `Editar — ${editTarget?.NOMBRE}`}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Nombre */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Nombre *</label>
                <input value={form.NOMBRE} onChange={e => setForm(f => ({ ...f, NOMBRE: e.target.value }))}
                  placeholder="Netflix, Spotify, Claude…"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50" />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Descripción</label>
                <input value={form.DESCRIPCION} onChange={e => setForm(f => ({ ...f, DESCRIPCION: e.target.value }))}
                  placeholder="Plan Premium, 4K, Individual…"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50" />
              </div>

              {/* Precio + Moneda */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Precio</label>
                  <input type="number" value={form.PRECIO} onChange={e => setForm(f => ({ ...f, PRECIO: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Moneda</label>
                  <select value={form.MONEDA} onChange={e => setForm(f => ({ ...f, MONEDA: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Ciclo + Día cobro */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Ciclo</label>
                  <select value={form.CICLO} onChange={e => setForm(f => ({ ...f, CICLO: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
                    {Object.entries(CICLOS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Día de cobro</label>
                  <input type="number" min="1" max="31" value={form.DIA_COBRO}
                    onChange={e => setForm(f => ({ ...f, DIA_COBRO: e.target.value }))}
                    placeholder="15"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50" />
                </div>
              </div>

              {/* Categoría + Estado */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Categoría</label>
                  <select value={form.CATEGORIA} onChange={e => setForm(f => ({ ...f, CATEGORIA: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
                    {Object.entries(CATEGORIAS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Estado</label>
                  <select value={form.ESTADO} onChange={e => setForm(f => ({ ...f, ESTADO: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
                    {ESTADOS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              {/* Tarjeta */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Tarjeta / Cuenta</label>
                <input value={form.TARJETA} onChange={e => setForm(f => ({ ...f, TARJETA: e.target.value }))}
                  placeholder="Nubank 8126, Bancolombia AMEX…"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50" />
              </div>

              {/* Fecha inicio + URL */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Fecha inicio</label>
                  <input value={form.FECHA_INICIO} onChange={e => setForm(f => ({ ...f, FECHA_INICIO: e.target.value }))}
                    placeholder="01/01/2025"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">URL</label>
                  <input value={form.URL} onChange={e => setForm(f => ({ ...f, URL: e.target.value }))}
                    placeholder="https://…"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white border border-border rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={save} disabled={saving || !form.NOMBRE.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/80 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                {saving ? 'Guardando…' : modal === 'add' ? 'Crear suscripción' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
