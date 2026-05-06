import { useState, useEffect, type KeyboardEvent } from 'react'
import {
  DollarSign, ShoppingCart,
  Send, Loader2, Bot, Search, PiggyBank,
  AlertCircle, RefreshCw, Sparkles, ChevronDown,
} from 'lucide-react'

import { api } from '../api'
import { FinanceAgentChat, type AgentAction } from '../components/FinanceAgentChat'

const SUBPAGES = [
  { key: 'dashboard', label: 'Dashboard', hex: '#7C3AED' },
  { key: 'registros', label: 'Registros',  hex: '#10B981' },
]

const TABS_CONFIG = [
  { key: 'shops',      label: 'Shops',    colorVar: 'primary', hex: '#7C3AED' },
  { key: 'basket',     label: 'Basket',    colorVar: 'accent',  hex: '#06B6D4' },
  { key: 'essentials', label: 'Essentials', colorVar: 'warning', hex: '#FBBF24' },
  { key: 'ahorro',     label: 'Salvings',     colorVar: 'success', hex: '#4ADE80' },
  { key: 'debts',      label: 'Debt',     colorVar: 'danger',  hex: '#F87171' },
  { key: 'wishlist',   label: 'Wishlist',   colorVar: 'primary', hex: '#A78BFA' },
]

const TAB_COLUMNS: Record<TabKey, string[]> = {
  essentials: ['PRODUCTO', 'DESCRIPCION', 'MONEDA', 'VALOR', 'MEDIO PAGO', 'MODO'],
  ahorro:     ['NOMBRE', 'MEDIO', 'MES', 'VALOR'],
  basket:     ['PRODUCTO', 'DESCRIPCION', 'CATEGORIA', 'MONEDA', 'VALOR', 'CANTIDAD'],
  shops:      ['PRODUCT', 'DESCRIPTION', 'BRAND', 'CATEGORY', 'STORE', 'STORE2', 'COIN', 'VALUE', 'PAYMENT', 'ACCOUNT', 'DATE'],
  wishlist:   ['PRODUCTO', 'DESCRIPCION', 'MONEDA', 'VALOR', 'TIENDA', 'MEDIO', 'SOURCE'],
  debts:      ['PRODUCTO', 'DESCRIPCION', 'MONEDA', 'VALOR', 'PAGO', 'ESTADO', 'FECHA'],
}

type SubPageKey = 'dashboard' | 'registros'
type TabKey = 'shops' | 'basket' | 'essentials' | 'ahorro' | 'debts' | 'wishlist'
type Summary = Record<TabKey, { count: number; total_cop: number; error?: string }>
type Records = Record<string, string | number>[]

function formatCOP(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function formatCOPFull(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function renderFormField(col: string, value: string | number, onChange: (val: string) => void) {
  const baseClass = "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"

  if (col === 'VALOR' || col === 'VALUE' || col === 'CANTIDAD' || col === 'PAGO') {
    return (
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={baseClass}
        placeholder="0"
      />
    )
  }

  if (col === 'FECHA' || col === 'DATE' || col === 'MES' || col === 'CADUCIDAD') {
    return (
      <input
        type="date"
        value={String(value).split('/').reverse().join('-') || ''}
        onChange={e => {
          const [y, m, d] = e.target.value.split('-')
          onChange(`${d}/${m}/${y}`)
        }}
        className={baseClass}
      />
    )
  }

  if (col === 'MONEDA' || col === 'COIN') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value="">Seleccionar...</option>
        <option value="COP">COP</option>
        <option value="USD">USD</option>
      </select>
    )
  }

  if (col === 'ESTADO') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value="">Seleccionar...</option>
        <option value="PENDIENTE">PENDIENTE</option>
        <option value="PAGADO">PAGADO</option>
        <option value="PARCIAL">PARCIAL</option>
      </select>
    )
  }

  if (col === 'MODO') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value="">Seleccionar...</option>
        <option value="MENSUAL">MENSUAL</option>
        <option value="BIMENSUAL">BIMENSUAL</option>
        <option value="SEMESTRAL">SEMESTRAL</option>
        <option value="ANUAL">ANUAL</option>
        <option value="ÚNICO">ÚNICO</option>
      </select>
    )
  }

  if (col === 'CATEGORIA' || col === 'CATEGORY') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value="">Seleccionar...</option>
        <option value="Ropa">Ropa</option>
        <option value="Comida">Comida</option>
        <option value="Hogar">Hogar</option>
        <option value="Tecnología">Tecnología</option>
        <option value="Entretenimiento">Entretenimiento</option>
        <option value="Regalo">Regalo</option>
        <option value="Otro">Otro</option>
      </select>
    )
  }

  if (col === 'PRIORIDAD') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value="">Seleccionar...</option>
        <option value="Alta">Alta</option>
        <option value="Media">Media</option>
        <option value="Baja">Baja</option>
      </select>
    )
  }

  if (col === 'MEDIO PAGO' || col === 'MEDIO' || col === 'PAYMENT') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value="">Seleccionar...</option>
        <option value="Efectivo">Efectivo</option>
        <option value="Tarjeta">Tarjeta</option>
        <option value="Transferencia">Transferencia</option>
        <option value="Nequi">Nequi</option>
        <option value="Daviplata">Daviplata</option>
      </select>
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={baseClass}
    />
  )
}

const SUMMARY_CARDS = [
  { key: 'shops'  as TabKey, label: 'Compras',    Icon: ShoppingCart, color: 'text-primary', bg: 'bg-primary/10',  border: 'border-primary/20'  },
  { key: 'basket' as TabKey, label: 'Canasta',    Icon: ShoppingCart, color: 'text-accent',  bg: 'bg-accent/10',   border: 'border-accent/20'   },
  { key: 'ahorro' as TabKey, label: 'Ahorro',     Icon: PiggyBank,    color: 'text-success', bg: 'bg-success/10',  border: 'border-success/20'  },
  { key: 'debts'  as TabKey, label: 'Deudas',     Icon: AlertCircle,  color: 'text-danger',  bg: 'bg-danger/10',   border: 'border-danger/20'   },
]

export function Finance() {
  // ── Subpage navigation ─────────────────────────────────────────────────────
  const [activeSubPage, setActiveSubPage] = useState<SubPageKey>('dashboard')

  // ── Natural language input ─────────────────────────────────────────────────
  const [input, setInput]             = useState('')
  const [writing, setWriting]         = useState(false)
  const [writeResult, setWriteResult] = useState<{
    status: string
    confirmation?: string
    question?: string
    tab?: string
  } | null>(null)

  // ── Summary ────────────────────────────────────────────────────────────────
  const [summary, setSummary]               = useState<Partial<Summary>>({})
  const [summaryLoading, setSummaryLoading] = useState(true)

  // ── Transaction table ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState<TabKey>('shops')
  const [records, setRecords]               = useState<Records>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [search, setSearch]                 = useState('')

  // ── CRUD Registros ─────────────────────────────────────────────────────────
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [editingIndex, setEditingIndex]       = useState<number | null>(null)
  const [recordForm, setRecordForm]           = useState<Record<string, string | number>>({})
  const [crudTab, setCrudTab]                 = useState<TabKey>('shops')
  const [saving, setSaving]                   = useState(false)
  const [saveError, setSaveError]             = useState('')
  const [ocrImage, setOcrImage]               = useState<string | null>(null)
  const [ocrLoading, setOcrLoading]           = useState(false)

  // ── Finance Agent Chat ─────────────────────────────────────────────────────
  const [agentChatOpen, setAgentChatOpen]     = useState(false)

  useEffect(() => { loadSummary() }, [])
  useEffect(() => {
    if (activeSubPage === 'dashboard') loadRecords(activeTab)
  }, [activeTab, activeSubPage])
  useEffect(() => {
    if (activeSubPage === 'registros') loadRecords(crudTab)
  }, [crudTab, activeSubPage])

  // ── AI Analysis ───────────────────────────────────────────────────────────
  const [analysisText, setAnalysisText]     = useState('')
  const [analysisTab, setAnalysisTab]       = useState<TabKey>('shops')
  const [analyzing, setAnalyzing]           = useState(false)
  const [analysisResult, setAnalysisResult] = useState('')

  // ── CRUD Functions ─────────────────────────────────────────────────────────
  async function handleCreateRecord() {
    setSaving(true)
    setSaveError('')
    try {
      const res = await api('/finance/records', {
        method: 'POST',
        body: { tab: crudTab, data: recordForm },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al crear el registro')
      }
      await loadRecords(crudTab)
      setShowRecordModal(false)
      setRecordForm({})
      setOcrImage(null)
    } catch (e: any) {
      setSaveError(e.message || 'Error de conexión')
      console.error('Create error:', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleOcrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setOcrImage(reader.result as string)
    reader.readAsDataURL(file)
    setOcrLoading(true)
    setSaveError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('tab', crudTab)
      const res = await api('/finance/ocr', { method: 'POST', body: form })
      if (!res.ok) throw new Error('Error en OCR')
      const { extracted } = await res.json()
      if (extracted) setRecordForm(prev => ({ ...prev, ...extracted }))
    } catch {
      setSaveError('No se pudo leer la factura, completa los campos manualmente.')
    } finally {
      setOcrLoading(false)
    }
  }

  async function handleUpdateRecord() {
    if (editingIndex === null) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await api('/finance/records', {
        method: 'PUT',
        body: { tab: crudTab, row_index: editingIndex, data: recordForm },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al actualizar el registro')
      }
      await loadRecords(crudTab)
      setShowRecordModal(false)
      setEditingIndex(null)
      setRecordForm({})
    } catch (e: any) {
      setSaveError(e.message || 'Error de conexión')
      console.error('Update error:', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRecord(index: number) {
    if (!confirm('¿Eliminar este registro?')) return
    try {
      const res = await api('/finance/records', {
        method: 'DELETE',
        body: { tab: crudTab, row_index: index },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al eliminar')
      }
      await loadRecords(crudTab)
    } catch (e: any) {
      alert('Error al eliminar: ' + (e.message || 'Error de conexión'))
      console.error('Delete error:', e)
    }
  }

  function openCreateModal() {
    setCrudTab(activeTab)
    setRecordForm({})
    setEditingIndex(null)
    setShowRecordModal(true)
  }

  function openEditModal(index: number) {
    setRecordForm({ ...records[index] })
    setEditingIndex(index)
    setShowRecordModal(true)
  }

  async function loadSummary() {
    setSummaryLoading(true)
    try {
      const res = await api('/finance/summary')
      setSummary(await res.json())
    } catch (e: any) { console.error('Error cargando resumen:', e) }
    finally { setSummaryLoading(false) }
  }

  async function loadRecords(tab: TabKey) {
    if (tab === 'registros' as any) return
    setRecordsLoading(true)
    setRecords([])
    setSearch('')
    try {
      const res = await api(`/finance/data/${tab}`)
      const data = await res.json()
      setRecords(data.records ?? [])
    } catch (e: any) { console.error('Error cargando registros:', e) }
    finally { setRecordsLoading(false) }
  }

  async function handleWrite() {
    if (!input.trim() || writing) return
    setWriting(true)
    setWriteResult(null)
    try {
      const res = await api('/finance/write', {
        method: 'POST',
        body: { text: input.trim() },
      })
      const data = await res.json()
      setWriteResult(data)
      if (data.status === 'written') {
        setInput('')
        loadSummary()
        if (data.tab === activeTab) loadRecords(activeTab)
      }
    } catch {
      setWriteResult({ status: 'error', confirmation: 'Error de conexión con el backend.' })
    } finally {
      setWriting(false)
    }
  }

  async function handleAnalyze() {
    if (!analysisText.trim() || analyzing) return
    setAnalyzing(true)
    setAnalysisResult('')
    try {
      const res = await api('/finance/analyze', {
        method: 'POST',
        body: { text: analysisText.trim(), tab: analysisTab },
      })
      const data = await res.json()
      setAnalysisResult(data.text ?? '')
    } catch {
      setAnalysisResult('Error al conectar con el agente de análisis.')
    } finally {
      setAnalyzing(false)
    }
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleWrite() }
  }

  function onAnalysisKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnalyze() }
  }

  const filteredRecords = records.filter(r =>
    Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  )

  const maxTotal = Math.max(
    ...Object.values(summary).map(s => s?.total_cop ?? 0),
    1,
  )

  const tableColumns = records.length > 0 ? Object.keys(records[0]) : []

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto max-w-6xl mx-auto w-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Finance</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión financiera · Google Sheets sync</p>
        </div>
        <div className="flex items-center gap-2">
          {SUBPAGES.map(sp => (
            <button
              key={sp.key}
              onClick={() => setActiveSubPage(sp.key as SubPageKey)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                activeSubPage === sp.key
                  ? 'text-white'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
              }`}
              style={activeSubPage === sp.key ? { backgroundColor: sp.hex + '22', borderColor: sp.hex + '55', color: sp.hex } : {}}
            >
              {sp.label}
            </button>
          ))}
          <button
            onClick={loadSummary}
            disabled={summaryLoading}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 bg-card border border-border px-3 py-2 rounded-lg transition-colors ml-2"
          >
            <RefreshCw size={13} className={summaryLoading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ── Dashboard SubPage ────────────────────────────────────────────── */}
      {activeSubPage === 'dashboard' && (
      <>
      {/* ── Natural Language Input ──────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={15} className="text-primary" />
          <span className="text-sm font-semibold text-white">Registrar gasto</span>
          <span className="text-xs text-slate-500 ml-1">— escribe en lenguaje natural</span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onInputKey}
            placeholder='ej: "gasté 80k en el mercado" · "pagué Netflix 45000" · "me deben 200k de Juan"'
            className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button
            onClick={handleWrite}
            disabled={!input.trim() || writing}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {writing
              ? <Loader2 size={15} className="animate-spin" />
              : <Send size={15} />
            }
            {writing ? 'Procesando…' : 'Registrar'}
          </button>
        </div>

        {/* Resultado del write */}
        {writeResult && (
          <div className={`flex items-start gap-2.5 text-sm px-4 py-3 rounded-lg border ${
            writeResult.status === 'written'
              ? 'bg-success/10 border-success/20 text-success'
              : writeResult.status === 'clarification_needed'
              ? 'bg-warning/10 border-warning/20 text-warning'
              : 'bg-danger/10 border-danger/20 text-danger'
          }`}>
            {writeResult.status === 'written' && (
              <>
                <span className="font-semibold">✓</span>
                <span>
                  {writeResult.confirmation}
                  {writeResult.tab && (
                    <span className="ml-2 text-xs opacity-70">→ {writeResult.tab}</span>
                  )}
                </span>
              </>
            )}
            {writeResult.status === 'clarification_needed' && (
              <>
                <span>?</span>
                <span>{writeResult.question}</span>
              </>
            )}
            {writeResult.status === 'error' && (
              <span>{writeResult.confirmation}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SUMMARY_CARDS.map(({ key, label, Icon, color, bg, border }) => {
          const data = summary[key]
          return (
            <div key={key} className="bg-card border border-border rounded-xl p-5">
              <div className={`w-9 h-9 ${bg} border ${border} rounded-lg flex items-center justify-center mb-3`}>
                <Icon size={16} className={color} />
              </div>
              <p className="text-xl font-bold text-white">
                {summaryLoading
                  ? <span className="inline-block w-16 h-5 bg-slate-700 rounded animate-pulse" />
                  : formatCOP(data?.total_cop ?? 0)
                }
              </p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
              {!summaryLoading && data && (
                <p className="text-xs text-slate-600 mt-0.5">{data.count} registros</p>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Bar Chart — Gastos por categoría ────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-5">Gastos por categoría (COP)</h3>
        <div className="space-y-3">
          {TABS_CONFIG.map(({ key, label, hex }) => {
            const data = summary[key as TabKey]
            const total = data?.total_cop ?? 0
            const pct   = maxTotal > 0 ? (total / maxTotal) * 100 : 0
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-24 text-right shrink-0">{label}</span>
                <div className="flex-1 h-7 bg-surface rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-700 flex items-center px-2"
                    style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: hex + '33', border: `1px solid ${hex}55` }}
                  >
                    {pct > 15 && (
                      <span className="text-xs font-medium" style={{ color: hex }}>
                        {formatCOP(total)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-500 w-20 shrink-0 text-right">
                  {summaryLoading
                    ? '…'
                    : formatCOP(total)
                  }
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Transactions Table ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-white">Transacciones</h3>

          {/* Tab Selector */}
          <div className="flex flex-wrap gap-1">
            {TABS_CONFIG.map(({ key, label, hex }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as TabKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  activeTab === key
                    ? 'text-white'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
                }`}
                style={activeTab === key ? { backgroundColor: hex + '22', borderColor: hex + '55', color: hex } : {}}
              >
                {label}
                {summary[key as TabKey] && (
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {summary[key as TabKey]!.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en esta pestaña…"
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {recordsLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Cargando desde Google Sheets…</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-600">
              <DollarSign size={24} />
              <span className="text-sm">
                {search ? 'Sin resultados para la búsqueda' : 'Sin registros en esta pestaña'}
              </span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {tableColumns.map(col => (
                    <th key={col} className="text-left text-xs text-slate-500 font-medium py-2 px-3 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-white/3 transition-colors">
                    {tableColumns.map(col => (
                      <td key={col} className="py-2 px-3 text-slate-300 whitespace-nowrap max-w-xs truncate">
                        {col === 'VALOR'
                          ? <span className="font-mono text-success text-xs">{formatCOPFull(Number(String(row[col]).replace(/\D/g, '')) || 0)}</span>
                          : col === 'ESTADO'
                          ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                              String(row[col]) === 'PAGADO'    ? 'bg-success/10 text-success border-success/20'
                              : String(row[col]) === 'PARCIAL' ? 'bg-warning/10 text-warning border-warning/20'
                              : 'bg-danger/10 text-danger border-danger/20'
                            }`}>
                              {row[col]}
                            </span>
                          )
                          : <span title={String(row[col])}>{String(row[col])}</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filteredRecords.length > 100 && (
          <p className="text-xs text-slate-600 text-center">
            Mostrando 100 de {filteredRecords.length} registros
          </p>
        )}
      </div>
      </>
      )}

      {/* ── Registros CRUD SubPage ───────────────────────────────────────── */}
      {activeSubPage === 'registros' && (
        <>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Gestión de Registros</h3>
              <p className="text-xs text-slate-500 mt-0.5">Agregar, editar o eliminar registros en Google Sheets</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={crudTab}
                onChange={e => { setCrudTab(e.target.value as TabKey); loadRecords(e.target.value as TabKey) }}
                className="bg-surface border border-border text-sm text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50"
              >
                {TABS_CONFIG.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
              <button
                onClick={() => setAgentChatOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent text-xs font-medium rounded-lg transition-colors"
              >
                <Bot size={13} />
                Agente
              </button>
              <button
                onClick={openCreateModal}
                className="px-3 py-2 bg-primary hover:bg-primary/80 text-white text-xs font-medium rounded-lg transition-colors"
              >
                + Nuevo Registro
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {recordsLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Cargando…</span>
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-600">
                <DollarSign size={24} />
                <span className="text-sm">Sin registros en {TABS_CONFIG.find(t => t.key === crudTab)?.label}</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {Object.keys(records[0]).map(col => (
                      <th key={col} className="text-left text-xs text-slate-500 font-medium py-2 px-3 whitespace-nowrap">{col}</th>
                    ))}
                    <th className="text-right text-xs text-slate-500 font-medium py-2 px-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-white/3 transition-colors">
                      {Object.keys(row).map(col => (
                        <td key={col} className="py-2 px-3 text-slate-300 whitespace-nowrap max-w-xs truncate" title={String(row[col])}>
                          {col === 'VALOR' ? <span className="font-mono text-success text-xs">{formatCOPFull(Number(String(row[col]).replace(/\D/g, '')) || 0)}</span> : String(row[col])}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button onClick={() => openEditModal(i)} className="text-xs text-accent hover:text-accent/80 mr-3">Editar</button>
                        <button onClick={() => handleDeleteRecord(i)} className="text-xs text-danger hover:text-danger/80">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <a
            href="https://docs.google.com/spreadsheets/d/1lVFrvgoT2N2Wdx-Vz-9qSTYQ0tM6r4JKdgAbtxU5870/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-400 hover:text-white border border-border rounded-lg hover:bg-white/5 transition-colors"
          >
            Abrir Google Sheet original
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
        </>
      )}

      {/* ── AI Analysis ─────────────────────────────────────────────────────── */}
      {activeSubPage === 'dashboard' && (
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-accent" />
          <h3 className="text-sm font-semibold text-white">Análisis con IA</h3>
          <span className="text-xs text-slate-500">— pregunta al agente de finanzas</span>
        </div>

        <div className="flex gap-2">
          {/* Tab select */}
          <div className="relative shrink-0">
            <select
              value={analysisTab}
              onChange={e => setAnalysisTab(e.target.value as TabKey)}
              className="appearance-none bg-surface border border-border text-sm text-slate-300 rounded-lg pl-3 pr-8 py-2.5 focus:outline-none focus:border-accent/50 cursor-pointer"
            >
              {TABS_CONFIG.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          <textarea
            value={analysisText}
            onChange={e => setAnalysisText(e.target.value)}
            onKeyDown={onAnalysisKey}
            rows={1}
            placeholder='ej: "¿cuánto gasté este mes?" · "¿cuál es mi producto más caro?" · "resume mis deudas pendientes"'
            className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-colors"
          />

          <button
            onClick={handleAnalyze}
            disabled={!analysisText.trim() || analyzing}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent/20 hover:bg-accent/30 border border-accent/30 disabled:opacity-40 disabled:cursor-not-allowed text-accent text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            {analyzing
              ? <Loader2 size={15} className="animate-spin" />
              : <Sparkles size={15} />
            }
            {analyzing ? 'Analizando…' : 'Analizar'}
          </button>
        </div>

        {/* Analysis Result */}
        {analysisResult && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bot size={14} className="text-accent" />
              <span className="text-xs text-slate-500 font-medium">
                Agente · {TABS_CONFIG.find(t => t.key === analysisTab)?.label}
              </span>
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {analysisResult}
            </p>
          </div>
        )}
      </div>
      )}

      {/* ── Finance Agent Chat Popup ─────────────────────────────────────── */}
      <FinanceAgentChat
        isOpen={agentChatOpen}
        onClose={() => setAgentChatOpen(false)}
        currentTab={crudTab}
        records={records}
        onActionExecuted={(action: AgentAction) => {
          // Toast de éxito
          const toast = (window as any).__addToast
          if (action.type === 'create') {
            toast?.({ message: `✅ ${action.confirmation || 'Registro creado'}`, type: 'success' })
          } else if (action.type === 'update') {
            toast?.({ message: `✏️ ${action.confirmation || 'Registro actualizado'}`, type: 'info' })
          } else if (action.type === 'delete') {
            toast?.({ message: `🗑️ ${action.confirmation || 'Registro eliminado'}`, type: 'warn' })
          }
          // Auto-switch de tab si el agente lo pide
          if (action.type === 'switch_tab' && action.tab) {
            setCrudTab(action.tab as TabKey)
            loadRecords(action.tab as TabKey)
            toast?.({ message: `📂 Cambiado a ${TABS_CONFIG.find(t => t.key === action.tab)?.label || action.tab}`, type: 'info' })
          }
        }}
        onRefresh={() => loadRecords(crudTab)}
      />

      {/* ── Record Modal ─────────────────────────────────────────────────── */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingIndex !== null ? 'Editar Registro' : 'Nuevo Registro'}
            </h3>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {/* Category selector (only for creation) */}
              {editingIndex === null && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block font-medium">Categoría</label>
                  <select
                    value={crudTab}
                    onChange={e => {
                      const newTab = e.target.value as TabKey
                      setCrudTab(newTab)
                      setRecordForm({})
                    }}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
                  >
                    {TABS_CONFIG.map(tab => (
                      <option key={tab.key} value={tab.key}>{tab.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {editingIndex === null && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block font-medium">
              Factura (opcional — OCR)
            </label>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-surface/50 overflow-hidden">
              {ocrLoading ? (
                <span className="text-xs text-slate-400 animate-pulse">Procesando imagen...</span>
              ) : ocrImage ? (
                <img src={ocrImage} alt="factura" className="h-full w-full object-contain" />
              ) : (
                <div className="text-center px-4">
                  <svg className="w-6 h-6 text-slate-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <span className="text-xs text-slate-400">Sube o toma foto de la factura</span>
                  <span className="text-xs text-slate-600 block mt-0.5">Los campos se llenarán automáticamente</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleOcrUpload}
                disabled={ocrLoading}
              />
            </label>
            {ocrImage && !ocrLoading && (
              <p className="text-xs text-emerald-400 mt-1">Datos extraídos. Revisa y corrige si es necesario.</p>
            )}
          </div>
        )}

        {/* Form fields */}
              {(editingIndex !== null
                ? Object.keys(records[0] || {})
                : TAB_COLUMNS[crudTab]
              ).map(col => (
                <div key={col}>
                  <label className="text-xs text-slate-400 mb-1 block">{col}</label>
                  {renderFormField(col, recordForm[col] ?? '', (val) => setRecordForm(prev => ({ ...prev, [col]: val })))}
                </div>
              ))}
            </div>

            {saveError && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm text-danger">{saveError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-border">
              <button 
                onClick={() => { setShowRecordModal(false); setSaveError(''); setOcrImage(null) }} 
                disabled={saving}
                className="flex-1 py-2 text-sm text-slate-400 hover:text-white border border-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={editingIndex !== null ? handleUpdateRecord : handleCreateRecord} 
                disabled={saving}
                className="flex-1 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : (editingIndex !== null ? 'Guardar Cambios' : 'Crear Registro')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
