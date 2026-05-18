import { useState, useEffect, type KeyboardEvent } from 'react'
import {
  DollarSign, ShoppingCart,
  Send, Loader2, Bot, Search, PiggyBank,
  AlertCircle, RefreshCw, Sparkles, ChevronDown,
  BarChart3, Table2, History, FileText, CreditCard, Building2, Upload, Check,
} from 'lucide-react'

import { api } from '../api'
import { FinanceAgentChat, type AgentAction } from '../components/FinanceAgentChat'
import { FinanceAnalytics } from '../components/FinanceAnalytics'

const SUBPAGES = [
  { key: 'dashboard', label: 'Dashboard', hex: '#7C3AED', icon: BarChart3 },
  { key: 'registros', label: 'Registros',  hex: '#10B981', icon: Table2   },
  { key: 'extractos', label: 'Extractos',  hex: '#3B82F6', icon: FileText },
  { key: 'history',   label: 'History',    hex: '#F59E0B', icon: History  },
]

const TABS_CONFIG = [
  { key: 'shops',      label: 'Shops',    colorVar: 'primary', hex: '#7C3AED' },
  { key: 'basket',     label: 'Basket',    colorVar: 'accent',  hex: '#06B6D4' },
  { key: 'essentials', label: 'Essentials', colorVar: 'warning', hex: '#FBBF24' },
  { key: 'ahorro',     label: 'Savings',     colorVar: 'success', hex: '#4ADE80' },
  { key: 'debts',      label: 'Debts',     colorVar: 'danger',  hex: '#F87171' },
  { key: 'wishlist',   label: 'Wishlist',   colorVar: 'primary', hex: '#A78BFA' },
  { key: 'credito',    label: 'Crédito',    colorVar: 'warning', hex: '#F97316' },
]

const TAB_COLUMNS: Record<TabKey, string[]> = {
  essentials: ['PRODUCTO', 'DESCRIPCION', 'MONEDA', 'VALOR', 'MEDIO PAGO', 'MODO'],
  ahorro:     ['NOMBRE', 'MEDIO', 'MES', 'VALOR'],
  basket:     ['PRODUCTO', 'DESCRIPCION', 'CATEGORIA', 'MONEDA', 'VALOR', 'CANTIDAD'],
  shops:      ['PRODUCT', 'DESCRIPTION', 'BRAND', 'CATEGORY', 'STORE', 'STORE2', 'COIN', 'VALUE', 'PAYMENT', 'ACCOUNT', 'CUOTAS', 'OFFER', 'DATE', 'SHOP_ID'],
  wishlist:   ['PRODUCTO', 'DESCRIPCION', 'MONEDA', 'VALOR', 'TIENDA', 'MEDIO', 'SOURCE'],
  debts:      ['PRODUCTO', 'DESCRIPCION', 'MONEDA', 'VALOR', 'PAGO', 'ESTADO', 'FECHA'],
  credito:    ['PRODUCTO', 'DESCRIPCION', 'ENTIDAD', 'MONEDA', 'VALOR_TOTAL', 'CUOTAS', 'CUOTA_ACTUAL', 'VALOR_CUOTA', 'FECHA_CORTE', 'FECHA_PAGO', 'ESTADO', 'TIPO'],
}

type SubPageKey = 'dashboard' | 'registros' | 'extractos' | 'history'
type TabKey = 'shops' | 'basket' | 'essentials' | 'ahorro' | 'debts' | 'wishlist' | 'credito'
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

  if (col === 'VALOR' || col === 'VALUE' || col === 'CANTIDAD' || col === 'PAGO' || col === 'VALOR_TOTAL' || col === 'CUOTAS' || col === 'CUOTA_ACTUAL' || col === 'VALOR_CUOTA') {
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

  if (col === 'TIPO') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value="">Seleccionar...</option>
        <option value="INGRESO">INGRESO (abono/pago)</option>
        <option value="EGRESO">EGRESO (deuda/compra)</option>
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
        <option value="Transporte">Transporte</option>
        <option value="Accesorios">Accesorios</option>
        <option value="Debt">Debt</option>
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

  if (col === 'ENTIDAD') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value=''>Seleccionar...</option>
        <option value='Nubank'>Nubank</option>
        <option value='Falabella'>Falabella</option>
        <option value='Bancolombia'>Bancolombia</option>
        <option value='Davivienda'>Davivienda</option>
        <option value='Nequi'>Nequi</option>
        <option value='Nu'>Nu</option>
        <option value='Otra'>Otra</option>
      </select>
    )
  }

  if (col === 'OFFER') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value="">Seleccionar...</option>
        <option value="SÍ">SÍ</option>
        <option value="NO">NO</option>
      </select>
    )
  }

  if (col === 'MEDIO PAGO' || col === 'MEDIO' || col === 'PAYMENT') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={baseClass + ' appearance-none cursor-pointer'}>
        <option value="">Seleccionar...</option>
        <option value="Efectivo">Efectivo</option>
        <option value="Tarjeta Débito">Tarjeta Débito</option>
        <option value="Tarjeta Crédito">Tarjeta Crédito</option>
        <option value="Transferencia">Transferencia</option>
        <option value="PSE">PSE</option>
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

const TAB_FILTERS: Record<TabKey, string[]> = {
  shops:      ['CATEGORY', 'STORE', 'COIN', 'PAYMENT', 'ACCOUNT'],
  debts:      ['MONEDA', 'ESTADO'],
  credito:    ['ENTIDAD', 'MONEDA', 'ESTADO', 'TIPO'],
  basket:     ['CATEGORIA', 'MONEDA'],
  essentials: ['MONEDA', 'MEDIO PAGO', 'MODO'],
  ahorro:     ['MEDIO', 'MONEDA'],
  wishlist:   ['MONEDA', 'TIENDA', 'MEDIO'],
}

function getUniqueValues(records: Records, col: string): string[] {
  const vals = new Set<string>()
  records.forEach(r => {
    const v = String(r[col] ?? '').trim()
    if (v) vals.add(v)
  })
  return Array.from(vals).sort((a, b) => a.localeCompare(b))
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

  // ── Column Filters (Registros) ─────────────────────────────────────────────
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [crudPage, setCrudPage] = useState(0)
  const CRUD_PAGE_SIZE = 15

  // ── Crédito filter toggle ──────────────────────────────────────────────────
  const [creditoFilter, setCreditoFilter] = useState<'total' | 'ingreso' | 'egreso'>('total')

  // ── CRUD Registros ─────────────────────────────────────────────────────────
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [editingIndex, setEditingIndex]       = useState<number | null>(null)
  const [recordForm, setRecordForm]           = useState<Record<string, string | number>>({})
  const [crudTab, setCrudTab]                 = useState<TabKey>('shops')
  const [saving, setSaving]                   = useState(false)
  const [saveError, setSaveError]             = useState('')
  const [ocrImage, setOcrImage]               = useState<string | null>(null)
  const [ocrLoading, setOcrLoading]           = useState(false)

  // ── Bulk Purchase Modal ─────────────────────────────────────────────────────
  const [showBulkModal, setShowBulkModal]   = useState(false)
  const [bulkCommon, setBulkCommon]         = useState<Record<string, string>>({})
  const [bulkItems, setBulkItems]           = useState<Record<string, string>[]>([{}])
  const [bulkSaving, setBulkSaving]         = useState(false)
  const [bulkError, setBulkError]           = useState('')

  const BULK_COMMON_FIELDS = ['STORE', 'STORE2', 'COIN', 'PAYMENT', 'CUOTAS', 'ACCOUNT', 'DATE']
  const BULK_ITEM_FIELDS   = ['PRODUCT', 'DESCRIPTION', 'BRAND', 'CATEGORY', 'VALUE', 'OFFER']
  const [crudView, setCrudView] = useState<'list' | 'grouped'>('list')
  const [grouping, setGrouping] = useState(false)
  const [expandedShops, setExpandedShops] = useState<Set<number>>(new Set())
  const [editingShop, setEditingShop] = useState<{ shopId: string; indices: number[] } | null>(null)
  const [shopEditForm, setShopEditForm] = useState<Record<string, string>>({})
  const [shopEditSaving, setShopEditSaving] = useState(false)
  const [shopEditError, setShopEditError] = useState('')

  function openShopEdit(shopId: string, items: { row: Record<string, string | number>; i: number }[]) {
    const first = items[0].row
    const form: Record<string, string> = {}
    for (const col of BULK_COMMON_FIELDS) form[col] = String(first[col] ?? '')
    setShopEditForm(form)
    setEditingShop({ shopId, indices: items.map(it => it.i) })
    setShopEditError('')
  }

  async function handleShopEditSave() {
    if (!editingShop) return
    setShopEditSaving(true)
    setShopEditError('')
    try {
      const updates = editingShop.indices.map(idx =>
        api('/finance/records', {
          method: 'PUT',
          body: { tab: 'shops', row_index: idx, data: { ...records[idx], ...shopEditForm } },
        })
      )
      await Promise.all(updates)
      await loadRecords('shops')
      setEditingShop(null)
    } catch (e: any) {
      setShopEditError(e.message || 'Error al guardar')
    } finally {
      setShopEditSaving(false)
    }
  }

  function generateShopId() {
    const now = new Date()
    const d = now.toISOString().slice(0, 10).replace(/-/g, '')
    const r = Math.random().toString(36).slice(2, 6).toUpperCase()
    return `S-${d}-${r}`
  }

  async function handleBulkSave() {
    if (bulkItems.every(item => !item['PRODUCT'])) {
      setBulkError('Agrega al menos un producto')
      return
    }
    setBulkSaving(true)
    setBulkError('')
    try {
      const shopId = generateShopId()
      const rows = bulkItems
        .filter(item => item['PRODUCT'])
        .map(item => ({ ...bulkCommon, ...item, SHOP_ID: shopId }))
      const res = await api('/finance/records/batch', {
        method: 'POST',
        body: { tab: 'shops', rows },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al crear los registros')
      }
      await loadRecords(crudTab === 'shops' ? 'shops' : crudTab)
      setShowBulkModal(false)
      setBulkCommon({})
      setBulkItems([{}])
    } catch (e: any) {
      setBulkError(e.message || 'Error de conexión')
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleGroupSelected() {
    if (selectedRows.size < 2) return
    setGrouping(true)
    try {
      const shopId = generateShopId()
      const updates = Array.from(selectedRows).map(idx =>
        api('/finance/records', {
          method: 'PUT',
          body: { tab: 'shops', row_index: idx, data: { ...records[idx], SHOP_ID: shopId } },
        })
      )
      await Promise.all(updates)
      await loadRecords('shops')
      setSelectedRows(new Set())
    } catch (e: any) {
      console.error('Error agrupando:', e)
    } finally {
      setGrouping(false)
    }
  }

  // ── Delete Confirmation Modal ──────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteIndex, setDeleteIndex]         = useState<number | null>(null)
  const [deleteReason, setDeleteReason]       = useState('')
  const [deleteLoading, setDeleteLoading]     = useState(false)
  const [selectedRows, setSelectedRows]     = useState<Set<number>>(new Set())
  const [migrating, setMigrating]           = useState(false)

  // ── Finance Agent Chat ─────────────────────────────────────────────────────
  const [agentChatOpen, setAgentChatOpen]     = useState(false)

  // ── History ─────────────────────────────────────────────────────────────────
  const [historyData, setHistoryData]         = useState<any[]>([])
  const [historyLoading, setHistoryLoading]   = useState(false)
  const [historyTab, setHistoryTab]           = useState<TabKey | 'all'>('all')

  // ── Extractos ──────────────────────────────────────────────────────────────
  const [extractoTab, setExtractoTab]             = useState<'creditos' | 'cuentas'>('creditos')
  const [extractoEntity, setExtractoEntity]       = useState('nubank')
  const [extractoFile, setExtractoFile]           = useState<File | null>(null)
  const [extractoPassword, setExtractoPassword]   = useState('')
  const [extractoParsing, setExtractoParsing]     = useState(false)
  const [extractoError, setExtractoError]         = useState('')
  const [extractoTransactions, setExtractoTransactions] = useState<any[]>([])
  const [extractoSelected, setExtractoSelected]   = useState<Set<number>>(new Set())
  const [extractoSaving, setExtractoSaving]       = useState(false)
  const [extractoSource, setExtractoSource]       = useState<'upload' | 'drive'>('upload')
  const [extractoMetadata, setExtractoMetadata]   = useState<Record<string, string>>({})

  // Drive state
  const [driveAvailable, setDriveAvailable]       = useState(false)
  const [driveEmail, setDriveEmail]               = useState('')
  const [driveFolders, setDriveFolders]           = useState<any[]>([])
  const [driveFiles, setDriveFiles]               = useState<any[]>([])
  const [, setDriveCurrentFolder] = useState<string | null>(null)
  const [driveBreadcrumb, setDriveBreadcrumb]     = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Extractos' }])
  const [driveLoading, setDriveLoading]           = useState(false)
  const [driveSelectedFile, setDriveSelectedFile] = useState<any | null>(null)
  const [driveImportedIds, setDriveImportedIds]   = useState<Set<string>>(new Set())
  const [extractoImports, setExtractoImports]     = useState<any[]>([])
  const [extractoImportsLoading, setExtractoImportsLoading] = useState(false)

  const EXTRACTO_ENTITIES: Record<string, { label: string; color: string; card: { last4: string; type: string; expires: string; since: string; corte: string } }> = {
    nubank:       { label: 'Nubank',       color: '#820AD1', card: { last4: '8126', type: 'Mastercard', expires: '04/34', since: '01/05/2026', corte: '15/mes' } },
    lulobank:     { label: 'Lulo Bank',    color: '#00D26A', card: { last4: '••••', type: '—',          expires: '—',     since: '—',          corte: '—' } },
    bancolombia:  { label: 'Bancolombia',  color: '#FDDA24', card: { last4: '••••', type: '—',          expires: '—',     since: '—',          corte: '—' } },
    falabella:    { label: 'Falabella',    color: '#BDD732', card: { last4: '••••', type: '—',          expires: '—',     since: '—',          corte: '—' } },
  }

  async function loadDriveStatus() {
    try {
      const res = await api('/finance/drive/status')
      if (res.ok) {
        const data = await res.json()
        setDriveAvailable(data.available)
        setDriveEmail(data.service_account_email || '')
      }
    } catch { /* ignore */ }
  }

  async function loadImportedDriveIds() {
    try {
      const res = await api('/finance/extracto-imports/drive-ids')
      if (res.ok) {
        const data = await res.json()
        setDriveImportedIds(new Set(data.imported_ids || []))
      }
    } catch { /* ignore */ }
  }

  async function loadExtractoImports() {
    setExtractoImportsLoading(true)
    try {
      const res = await api('/finance/extracto-imports')
      if (res.ok) {
        const data = await res.json()
        setExtractoImports(data.imports || [])
      }
    } catch { /* ignore */ }
    setExtractoImportsLoading(false)
  }

  async function loadDriveFolder(folderId: string | null) {
    setDriveLoading(true)
    setDriveSelectedFile(null)
    try {
      const params = folderId ? `?folder_id=${folderId}` : ''
      const [foldersRes, filesRes] = await Promise.all([
        api(`/finance/drive/folders${params}`),
        api(`/finance/drive/files${params}`),
      ])
      if (foldersRes.ok) setDriveFolders((await foldersRes.json()).folders || [])
      if (filesRes.ok) setDriveFiles((await filesRes.json()).files || [])
      setDriveCurrentFolder(folderId)
    } catch { /* ignore */ }
    setDriveLoading(false)
  }

  function navigateDriveFolder(folderId: string, folderName: string) {
    setDriveBreadcrumb(prev => [...prev, { id: folderId, name: folderName }])
    loadDriveFolder(folderId)
  }

  function navigateBreadcrumb(index: number) {
    const target = driveBreadcrumb[index]
    setDriveBreadcrumb(prev => prev.slice(0, index + 1))
    loadDriveFolder(target.id)
  }

  async function handleExtractoParse() {
    if (!extractoFile) return
    setExtractoParsing(true)
    setExtractoError('')
    setExtractoTransactions([])
    setExtractoMetadata({})
    try {
      const formData = new FormData()
      formData.append('file', extractoFile)
      formData.append('password', extractoPassword)
      formData.append('entity', extractoEntity)
      formData.append('statement_type', extractoTab === 'creditos' ? 'credito' : 'cuenta')
      const res = await api('/finance/extract-statement', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        let errMsg = 'Error al parsear extracto'
        try { const err = await res.json(); errMsg = err.detail || errMsg } catch {}
        throw new Error(errMsg)
      }
      const data = await res.json()
      const txns = data.transactions || []
      setExtractoTransactions(txns)
      setExtractoMetadata(data.metadata || {})
      setExtractoSelected(new Set(txns.map((_: any, i: number) => i)))
      if (txns.length === 0) {
        const preview = data.raw_text_preview ? `\n\nTexto extraído:\n${data.raw_text_preview}` : ''
        setExtractoError(`No se encontraron transacciones en el PDF. Páginas: ${data.raw_pages || '?'}${preview}`)
      }
    } catch (e: any) {
      setExtractoError(e.message || 'Error de conexión')
    } finally {
      setExtractoParsing(false)
    }
  }

  async function handleDriveParse() {
    if (!driveSelectedFile) return
    setExtractoParsing(true)
    setExtractoError('')
    setExtractoTransactions([])
    setExtractoMetadata({})
    try {
      const formData = new FormData()
      formData.append('file_id', driveSelectedFile.id)
      formData.append('password', extractoPassword)
      formData.append('entity', extractoEntity)
      formData.append('statement_type', extractoTab === 'creditos' ? 'credito' : 'cuenta')
      const res = await api('/finance/drive/parse', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        let errMsg = 'Error al parsear extracto desde Drive'
        try { const err = await res.json(); errMsg = err.detail || errMsg } catch {}
        throw new Error(errMsg)
      }
      const data = await res.json()
      const txns = data.transactions || []
      setExtractoTransactions(txns)
      setExtractoMetadata(data.metadata || {})
      setExtractoSelected(new Set(txns.map((_: any, i: number) => i)))
      if (txns.length === 0) {
        const preview = data.raw_text_preview ? `\n\nTexto extraído:\n${data.raw_text_preview}` : ''
        setExtractoError(`No se encontraron transacciones en el PDF. Páginas: ${data.raw_pages || '?'}${preview}`)
      }
    } catch (e: any) {
      setExtractoError(e.message || 'Error de conexión')
    } finally {
      setExtractoParsing(false)
    }
  }

  async function handleExtractoImport() {
    const selected = extractoTransactions.filter((_, i) => extractoSelected.has(i))
    if (!selected.length) return
    setExtractoSaving(true)
    setExtractoError('')
    try {
      const rows = selected.map(t => ({
        PRODUCTO: t.DESCRIPCION,
        DESCRIPCION: `Extracto ${EXTRACTO_ENTITIES[extractoEntity]?.label || extractoEntity}`,
        ENTIDAD: t.ENTIDAD || extractoEntity,
        MONEDA: 'COP',
        VALOR_TOTAL: Math.round(t.VALOR || 0),
        CUOTAS: t.CUOTAS ? String(t.CUOTAS).split('/')[1] || t.CUOTAS : '1',
        CUOTA_ACTUAL: t.CUOTAS ? String(t.CUOTAS).split('/')[0] || '1' : '1',
        VALOR_CUOTA: Math.round(t.VALOR_CUOTA || t.VALOR || 0),
        FECHA_CORTE: '',
        FECHA_PAGO: t.FECHA,
        ESTADO: 'PENDIENTE',
        TIPO: 'EGRESO',
      }))
      const res = await api('/finance/records/batch', {
        method: 'POST',
        body: { tab: 'credito', rows },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al importar')
      }

      // Registrar importación
      const totalAmount = selected.reduce((s, t) => s + (t.VALOR || 0), 0)
      const firstDate = selected[0]?.FECHA || ''
      const period = firstDate ? firstDate.split('/').slice(1).reverse().join('-') : new Date().toISOString().slice(0, 7)
      const fileName = extractoSource === 'drive' && driveSelectedFile ? driveSelectedFile.name : (extractoFile?.name || 'upload.pdf')
      const driveId = extractoSource === 'drive' && driveSelectedFile ? driveSelectedFile.id : ''

      const importForm = new FormData()
      importForm.append('entity', extractoEntity)
      importForm.append('statement_type', extractoTab === 'creditos' ? 'credito' : 'cuenta')
      importForm.append('period', period)
      importForm.append('file_name', fileName)
      importForm.append('drive_file_id', driveId)
      importForm.append('transactions', String(selected.length))
      importForm.append('total_amount', String(Math.round(totalAmount)))
      await api('/finance/extracto-imports', { method: 'POST', body: importForm }).catch(() => {})

      if (driveId) setDriveImportedIds(prev => new Set([...prev, driveId]))
      setExtractoTransactions([])
      setExtractoFile(null)
      setExtractoSelected(new Set())
      loadExtractoImports()
    } catch (e: any) {
      setExtractoError(e.message || 'Error al importar')
    } finally {
      setExtractoSaving(false)
    }
  }

  useEffect(() => { loadSummary() }, [])
  useEffect(() => {
    if (activeSubPage === 'dashboard') loadRecords(activeTab)
  }, [activeTab, activeSubPage])
  useEffect(() => {
    if (activeSubPage === 'registros') loadRecords(crudTab)
  }, [crudTab, activeSubPage])
  useEffect(() => {
    if (activeSubPage === 'history') loadHistory()
  }, [activeSubPage, historyTab])
  useEffect(() => {
    if (activeSubPage === 'extractos') {
      loadDriveStatus()
      loadDriveFolder(null)
      loadImportedDriveIds()
      loadExtractoImports()
    }
  }, [activeSubPage])

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

  function openDeleteModal(index: number) {
    setDeleteIndex(index)
    setDeleteReason('')
    setShowDeleteModal(true)
  }

  async function handleMigrateCredito() {
    setMigrating(true)
    try {
      const res = await api("/finance/migrate-credito", { method: "POST" })
      const data = await res.json()
      alert("Migracion: " + (data.created || 0) + " creados, " + (data.updated || 0) + " actualizados, " + (data.skipped || 0) + " sin cambios")
      loadRecords("credito")
      loadSummary()
    } catch (e: any) {
      alert("Error: " + (e.message || "Desconocido"))
    } finally {
      setMigrating(false)
    }
  }

  function toggleSelectRow(index: number) {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleBulkDelete() {
    if (!confirm("Eliminar " + selectedRows.size + " registros seleccionados?")) return
    const indices = Array.from(selectedRows).sort((a,b) => b-a)
    for (const i of indices) {
      try {
        await api("/finance/records", { method: "DELETE", body: { tab: crudTab, row_index: i } })
      } catch (e: any) {
        alert("Error eliminando fila " + i + ": " + (e.message || "Desconocido"))
        break
      }
    }
    setSelectedRows(new Set())
    loadRecords(crudTab)
    loadSummary()
  }

  async function handleConfirmDelete() {
    if (deleteIndex === null || !deleteReason.trim()) return
    setDeleteLoading(true)
    try {
      const res = await api('/finance/records', {
        method: 'DELETE',
        body: { tab: crudTab, row_index: deleteIndex, reason: deleteReason.trim() },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al eliminar')
      }
      await loadRecords(crudTab)
      setShowDeleteModal(false)
      setDeleteIndex(null)
      setDeleteReason('')
      // Toast de éxito
      ;(window as any).__addToast?.({ message: 'Registro eliminado correctamente', type: 'success' })
    } catch (e: any) {
      ;(window as any).__addToast?.({ message: 'Error al eliminar: ' + (e.message || 'Error de conexión'), type: 'error' })
      console.error('Delete error:', e)
    } finally {
      setDeleteLoading(false)
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
    setColumnFilters({})
    setCreditoFilter('total')
    try {
      const res = await api(`/finance/data/${tab}`)
      const data = await res.json()
      setRecords(data.records ?? [])
    } catch (e: any) { console.error('Error cargando registros:', e) }
    finally { setRecordsLoading(false) }
  }

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const url = historyTab === 'all' ? '/finance/history' : `/finance/history?tab=${historyTab}`
      const res = await api(url)
      const data = await res.json()
      setHistoryData(data.history ?? [])
    } catch (e: any) { console.error('Error cargando historial:', e) }
    finally { setHistoryLoading(false) }
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

  const filteredCrudRecords = records.map((row, i) => ({ row, i })).filter(({ row }) => {
    if (search) {
      const matchesSearch = Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
      if (!matchesSearch) return false
    }
    for (const [col, val] of Object.entries(columnFilters)) {
      if (!val) continue
      if (String(row[col] ?? '').trim() !== val) return false
    }
    if (crudTab === 'credito' && creditoFilter !== 'total') {
      const tipo = String(row['TIPO'] ?? '').trim().toLowerCase()
      if (creditoFilter === 'ingreso' && tipo !== 'ingreso') return false
      if (creditoFilter === 'egreso' && tipo !== 'egreso') return false
    }
    if (dateFrom || dateTo) {
      const dateCol = row['DATE'] ?? row['FECHA'] ?? row['MES'] ?? row['FECHA_PAGO'] ?? ''
      const raw = String(dateCol).trim()
      if (!raw) return false
      const parts = raw.includes('/') ? raw.split('/') : raw.split('-')
      const iso = parts.length === 3
        ? (parts[0].length === 4 ? raw : `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
        : raw
      if (dateFrom && iso < dateFrom) return false
      if (dateTo && iso > dateTo) return false
    }
    return true
  }).reverse()

  const totalCrudPages = Math.ceil(filteredCrudRecords.length / CRUD_PAGE_SIZE)
  const paginatedCrudRecords = filteredCrudRecords.slice(crudPage * CRUD_PAGE_SIZE, (crudPage + 1) * CRUD_PAGE_SIZE)

  const groupedByShop = (() => {
    if (crudTab !== 'shops') return []
    type Entry = { row: Record<string, string | number>; i: number }
    const groups: { shopId: string; store: string; date: string; items: Entry[]; total: number }[] = []
    const map = new Map<string, Entry[]>()
    const ungrouped: Entry[] = []
    for (const entry of filteredCrudRecords) {
      const sid = String(entry.row['SHOP_ID'] ?? '').trim()
      if (sid) {
        if (!map.has(sid)) map.set(sid, [])
        map.get(sid)!.push(entry)
      } else {
        ungrouped.push(entry)
      }
    }
    for (const [shopId, items] of map) {
      const first = items[0].row
      groups.push({
        shopId,
        store: String(first['STORE'] ?? ''),
        date: String(first['DATE'] ?? ''),
        items,
        total: items.reduce((sum, { row }) => sum + (Number(String(row['VALUE']).replace(/\D/g, '')) || 0), 0),
      })
    }
    groups.sort((a, b) => {
      const toIso = (d: string) => {
        if (!d) return ''
        const parts = d.includes('/') ? d.split('/') : d.split('-')
        return parts.length === 3 && parts[0].length <= 2
          ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
          : d
      }
      return toIso(b.date).localeCompare(toIso(a.date))
    })
    if (ungrouped.length > 0) {
      groups.push({ shopId: '', store: 'Sin agrupar', date: '', items: ungrouped, total: ungrouped.reduce((sum, { row }) => sum + (Number(String(row['VALUE']).replace(/\D/g, '')) || 0), 0) })
    }
    return groups
  })()

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
        <div className="flex items-center gap-1 bg-black/20 border border-border rounded-xl p-1">
          {SUBPAGES.map(sp => (
            <button
              key={sp.key}
              onClick={() => setActiveSubPage(sp.key as SubPageKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeSubPage === sp.key ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              style={activeSubPage === sp.key ? { backgroundColor: sp.hex + '25', color: sp.hex } : {}}
            >
              <sp.icon size={13} />
              <span className="hidden sm:inline">{sp.label}</span>
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

      {/* ── Analytics Panels ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-primary" />
          <h3 className="text-sm font-semibold text-white">Análisis por pestaña</h3>
          <span className="text-xs text-slate-500">— métricas detalladas de cada categoría</span>
        </div>
        <FinanceAnalytics />
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
          {selectedRows.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg mb-3">
                <span className="text-xs text-orange-400">{selectedRows.size} seleccionados</span>
                <button onClick={handleBulkDelete} className="px-2 py-1 text-xs bg-danger/20 hover:bg-danger/30 text-danger rounded transition-colors">Eliminar seleccionados</button>
                <button onClick={() => setSelectedRows(new Set())} className="px-2 py-1 text-xs text-slate-400 hover:text-white rounded transition-colors">Cancelar</button>
              </div>
            )}
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
            {crudTab === 'credito' && (
              <button
                onClick={handleMigrateCredito}
                disabled={migrating}
                className={"flex items-center gap-1 px-2 py-1 text-xs border rounded-lg transition-colors " + (migrating ? "opacity-50 cursor-wait" : "text-orange-400 border-orange-400/30 hover:bg-orange-400/10")}
              >
                {migrating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                {migrating ? "Migrando..." : "Sincronizar Shops → Crédito"}
              </button>
            )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={crudTab}
                onChange={e => { setCrudTab(e.target.value as TabKey); setSelectedRows(new Set()); setCrudPage(0); loadRecords(e.target.value as TabKey) }}
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
              {crudTab === 'shops' && (
                <button
                  onClick={() => { setShowBulkModal(true); setBulkCommon({}); setBulkItems([{}]); setBulkError('') }}
                  className="px-3 py-2 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent text-xs font-medium rounded-lg transition-colors"
                >
                  + Agregar Compra
                </button>
              )}
              <button
                onClick={openCreateModal}
                className="px-3 py-2 bg-primary hover:bg-primary/80 text-white text-xs font-medium rounded-lg transition-colors"
              >
                + Nuevo Registro
              </button>
            </div>
          </div>

          {/* Crédito toggle */}
          {crudTab === 'credito' && (
            <div className="flex items-center gap-1 bg-black/20 border border-border rounded-xl p-1 w-fit">
              {[
                { key: 'total', label: 'Total' },
                { key: 'ingreso', label: 'Ingresos' },
                { key: 'egreso', label: 'Egresos' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setCreditoFilter(t.key as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    creditoFilter === t.key
                      ? 'text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  style={creditoFilter === t.key ? { backgroundColor: '#F9731622', color: '#F97316' } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Search + Column Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar registros…"
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            {TAB_FILTERS[crudTab]?.map(col => {
              const options = getUniqueValues(records, col)
              if (options.length === 0) return null
              return (
                <select
                  key={col}
                  value={columnFilters[col] || ''}
                  onChange={e => setColumnFilters(prev => ({ ...prev, [col]: e.target.value }))}
                  className="bg-surface border border-border text-sm text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
                >
                  <option value="">{col}</option>
                  {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )
            })}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setCrudPage(0) }}
                className="bg-surface border border-border text-sm text-slate-300 rounded-lg px-2 py-2 focus:outline-none focus:border-primary/50"
              />
              <span className="text-xs text-slate-500">Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setCrudPage(0) }}
                className="bg-surface border border-border text-sm text-slate-300 rounded-lg px-2 py-2 focus:outline-none focus:border-primary/50"
              />
            </div>
            {(search || Object.values(columnFilters).some(Boolean) || creditoFilter !== 'total' || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setColumnFilters({}); setCreditoFilter('total'); setDateFrom(''); setDateTo(''); setCrudPage(0) }}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 border border-border rounded-lg transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Vista toggle (solo shops) */}
          {crudTab === 'shops' && (
            <div className="flex items-center gap-1 bg-black/20 border border-border rounded-xl p-1 w-fit">
              {[
                { key: 'list', label: 'Lista' },
                { key: 'grouped', label: 'Por Compra' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setCrudView(t.key as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    crudView === t.key ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  style={crudView === t.key ? { backgroundColor: '#06B6D422', color: '#06B6D4' } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            {selectedRows.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg mb-3">
                <span className="text-xs text-orange-400">{selectedRows.size} seleccionados</span>
                {crudTab === 'shops' && selectedRows.size >= 2 && (
                  <button onClick={handleGroupSelected} disabled={grouping} className="px-2 py-1 text-xs bg-accent/20 hover:bg-accent/30 text-accent rounded transition-colors disabled:opacity-50">
                    {grouping ? 'Agrupando...' : 'Agrupar en Compra'}
                  </button>
                )}
                <button onClick={handleBulkDelete} className="px-2 py-1 text-xs bg-danger/20 hover:bg-danger/30 text-danger rounded transition-colors">Eliminar seleccionados</button>
                <button onClick={() => setSelectedRows(new Set())} className="px-2 py-1 text-xs text-slate-400 hover:text-white rounded transition-colors">Cancelar</button>
              </div>
            )}
            {recordsLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Cargando…</span>
              </div>
            ) : paginatedCrudRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-600">
                <DollarSign size={24} />
                <span className="text-sm">
                  {(search || Object.values(columnFilters).some(Boolean))
                    ? 'Sin registros que coincidan con los filtros'
                    : `Sin registros en ${TABS_CONFIG.find(t => t.key === crudTab)?.label}`}
                </span>
              </div>
            ) : (crudView === 'list' || crudTab !== 'shops') ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-center text-xs text-slate-500 font-medium py-2 px-2"><input type="checkbox" onChange={() => { const visibleIdx = new Set(paginatedCrudRecords.map(({ i }) => i)); if (visibleIdx.size > 0 && Array.from(visibleIdx).every(idx => selectedRows.has(idx))) { const next = new Set(selectedRows); Array.from(visibleIdx).forEach(idx => next.delete(idx)); setSelectedRows(next); } else { const next = new Set(selectedRows); Array.from(visibleIdx).forEach(idx => next.add(idx)); setSelectedRows(next); } }} className="rounded" /></th>
                    <th className="text-center text-xs text-slate-500 font-medium py-2 px-3 whitespace-nowrap w-[100px]">Acciones</th>
                    {Object.keys(records[0]).map(col => (
                      <th key={col} className="text-left text-xs text-slate-500 font-medium py-2 px-3 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedCrudRecords.map(({ row, i }) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-white/3 transition-colors">
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleSelectRow(i)} className="rounded" />
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(i)}
                            title="Editar"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent hover:text-accent transition-colors"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button
                            onClick={() => openDeleteModal(i)}
                            title="Eliminar"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger hover:text-danger transition-colors"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </div>
                      </td>
                      {Object.keys(row).map(col => (
                        <td key={col} className="py-2 px-3 text-slate-300 whitespace-nowrap max-w-xs truncate" title={String(row[col])}>
                          {col === 'VALOR' ? <span className="font-mono text-success text-xs">{formatCOPFull(Number(String(row[col]).replace(/\D/g, '')) || 0)}</span> : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* ── Vista agrupada por compra ── */
              <div className="space-y-4">
                {groupedByShop.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-600">
                    <ShoppingCart size={24} />
                    <span className="text-sm">Sin compras agrupadas</span>
                  </div>
                ) : groupedByShop.map((group, gi) => (
                  <div key={gi} className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-surface/50 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                          <ShoppingCart size={14} className="text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {group.store}{group.date ? ` — ${group.date}` : ''}
                          </p>
                          <p className="text-xs text-slate-500">
                            {group.shopId ? <span className="font-mono text-slate-600">{group.shopId}</span> : 'Registros individuales'}
                            {' · '}{group.items.length} item{group.items.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-success">{formatCOPFull(group.total)}</span>
                        {group.shopId && (
                          <button
                            onClick={() => openShopEdit(group.shopId, group.items)}
                            title="Editar compra"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedShops(prev => {
                            const next = new Set(prev)
                            next.has(gi) ? next.delete(gi) : next.add(gi)
                            return next
                          })}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-border hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                          title={expandedShops.has(gi) ? 'Ocultar desglose' : 'Ver desglose'}
                        >
                          <ChevronDown size={14} className={`transition-transform ${expandedShops.has(gi) ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                    {expandedShops.has(gi) && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left text-xs text-slate-500 font-medium py-2 px-4">PRODUCT</th>
                          <th className="text-left text-xs text-slate-500 font-medium py-2 px-3">BRAND</th>
                          <th className="text-left text-xs text-slate-500 font-medium py-2 px-3">CATEGORY</th>
                          <th className="text-right text-xs text-slate-500 font-medium py-2 px-3">VALUE</th>
                          <th className="text-center text-xs text-slate-500 font-medium py-2 px-3">OFFER</th>
                          <th className="text-center text-xs text-slate-500 font-medium py-2 px-3 w-[80px]">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(({ row, i }) => (
                          <tr key={i} className="border-b border-border/30 hover:bg-white/3 transition-colors">
                            <td className="py-2 px-4 text-slate-300 max-w-xs truncate" title={String(row['PRODUCT'])}>
                              <span className="font-medium">{String(row['PRODUCT'])}</span>
                              {row['DESCRIPTION'] && <span className="text-slate-500 text-xs ml-1.5">{String(row['DESCRIPTION'])}</span>}
                            </td>
                            <td className="py-2 px-3 text-slate-400 text-xs">{String(row['BRAND'] ?? '')}</td>
                            <td className="py-2 px-3 text-slate-400 text-xs">{String(row['CATEGORY'] ?? '')}</td>
                            <td className="py-2 px-3 text-right">
                              <span className="font-mono text-success text-xs">{formatCOPFull(Number(String(row['VALUE']).replace(/\D/g, '')) || 0)}</span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {String(row['OFFER'] ?? '').toUpperCase() === 'SÍ' && (
                                <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">Oferta</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => openEditModal(i)} title="Editar" className="inline-flex items-center justify-center w-6 h-6 rounded bg-accent/10 hover:bg-accent/20 text-accent transition-colors">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onClick={() => openDeleteModal(i)} title="Eliminar" className="inline-flex items-center justify-center w-6 h-6 rounded bg-danger/10 hover:bg-danger/20 text-danger transition-colors">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paginación */}
          {totalCrudPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-slate-500">
                {filteredCrudRecords.length} registros — Página {crudPage + 1} de {totalCrudPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCrudPage(0)}
                  disabled={crudPage === 0}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white border border-border rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  «
                </button>
                <button
                  onClick={() => setCrudPage(p => Math.max(0, p - 1))}
                  disabled={crudPage === 0}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white border border-border rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ‹ Anterior
                </button>
                <button
                  onClick={() => setCrudPage(p => Math.min(totalCrudPages - 1, p + 1))}
                  disabled={crudPage >= totalCrudPages - 1}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white border border-border rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Siguiente ›
                </button>
                <button
                  onClick={() => setCrudPage(totalCrudPages - 1)}
                  disabled={crudPage >= totalCrudPages - 1}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white border border-border rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  »
                </button>
              </div>
            </div>
          )}
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

      {/* ── Extractos SubPage ────────────────────────────────────────────── */}
      {activeSubPage === 'extractos' && (
        <div className="space-y-4">
          {/* Tabs Créditos / Cuentas */}
          <div className="flex items-center gap-3">
            {(['creditos', 'cuentas'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setExtractoTab(tab); setExtractoTransactions([]); setExtractoMetadata({}); setExtractoError('') }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  extractoTab === tab
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : 'text-slate-400 hover:text-white border border-border hover:bg-white/5'
                }`}
              >
                {tab === 'creditos' ? (
                  <span className="flex items-center gap-2"><CreditCard size={14} /> Créditos</span>
                ) : (
                  <span className="flex items-center gap-2"><Building2 size={14} /> Cuentas</span>
                )}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Importar Extracto — {extractoTab === 'creditos' ? 'Tarjeta de Crédito' : 'Cuenta Bancaria'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecciona un extracto desde Google Drive o sube un PDF directamente
              </p>
            </div>

            {/* Entity selector */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Entidad Bancaria</label>
              <div className="flex gap-2">
                {Object.entries(EXTRACTO_ENTITIES).map(([key, { label, color }]) => (
                  <button
                    key={key}
                    onClick={() => setExtractoEntity(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      extractoEntity === key
                        ? 'text-white border-2'
                        : 'text-slate-400 border border-border hover:text-white hover:bg-white/5'
                    }`}
                    style={extractoEntity === key ? { borderColor: color, backgroundColor: color + '20', color } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Card info widget */}
            {(() => {
              const ent = EXTRACTO_ENTITIES[extractoEntity]
              if (!ent) return null
              const { card } = ent
              return (
                <div
                  className="flex items-center gap-4 rounded-lg border px-4 py-3"
                  style={{ borderColor: ent.color + '30', backgroundColor: ent.color + '08' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CreditCard size={18} style={{ color: ent.color }} />
                    <span className="text-sm font-semibold text-white">{ent.label}</span>
                    <span className="text-xs font-mono text-slate-400">•••• {card.last4}</span>
                  </div>
                  <div className="h-4 w-px bg-white/10" />
                  <div className="flex items-center gap-5 text-xs">
                    <div>
                      <span className="text-slate-500">Tipo </span>
                      <span className="text-slate-200 font-medium">{card.type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Vence </span>
                      <span className="text-slate-200 font-medium">{card.expires}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Desde </span>
                      <span className="text-slate-200 font-medium">{card.since}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Corte </span>
                      <span className="text-slate-200 font-medium">{card.corte}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Source toggle: Drive / Upload */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Origen</label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setExtractoSource('drive'); setExtractoTransactions([]); setExtractoMetadata({}); setExtractoError('') }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    extractoSource === 'drive'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : 'text-slate-400 border border-border hover:text-white hover:bg-white/5'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 19.5h20L12 2z"/></svg>
                  Google Drive
                </button>
                <button
                  onClick={() => { setExtractoSource('upload'); setExtractoTransactions([]); setExtractoMetadata({}); setExtractoError('') }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    extractoSource === 'upload'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : 'text-slate-400 border border-border hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Upload size={14} />
                  Subir PDF
                </button>
              </div>
            </div>

            {/* ── Drive browser ── */}
            {extractoSource === 'drive' && (
              <div className="space-y-3">
                {!driveAvailable ? (
                  <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 space-y-2">
                    <p className="font-medium">Google Drive no configurado</p>
                    <p className="text-slate-400">
                      1. Agrega <code className="text-amber-300">DRIVE_EXTRACTOS_FOLDER_ID</code> al <code>.env</code> del backend con el ID de la carpeta de extractos.
                    </p>
                    {driveEmail && (
                      <p className="text-slate-400">
                        2. Comparte la carpeta con: <code className="text-amber-300 select-all">{driveEmail}</code>
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 text-xs text-slate-400 flex-wrap">
                      {driveBreadcrumb.map((b, idx) => (
                        <span key={idx} className="flex items-center gap-1">
                          {idx > 0 && <span className="text-slate-600">/</span>}
                          <button
                            onClick={() => navigateBreadcrumb(idx)}
                            className={`hover:text-white transition-colors ${idx === driveBreadcrumb.length - 1 ? 'text-white font-medium' : ''}`}
                          >
                            {b.name}
                          </button>
                        </span>
                      ))}
                    </div>

                    {driveLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                        <Loader2 size={14} className="animate-spin" /> Cargando archivos...
                      </div>
                    ) : (
                      <div className="border border-border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                        {/* Folders */}
                        {driveFolders.map(f => (
                          <button
                            key={f.id}
                            onClick={() => navigateDriveFolder(f.id, f.name)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-border/50"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400 shrink-0"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                            <span className="text-sm text-white">{f.name}</span>
                          </button>
                        ))}
                        {/* PDF Files */}
                        {driveFiles.map(f => {
                          const imported = driveImportedIds.has(f.id)
                          return (
                          <button
                            key={f.id}
                            onClick={() => setDriveSelectedFile(driveSelectedFile?.id === f.id ? null : f)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left border-b border-border/50 ${
                              driveSelectedFile?.id === f.id ? 'bg-blue-500/15' : 'hover:bg-white/5'
                            }`}
                          >
                            <FileText size={16} className={imported ? 'text-emerald-400 shrink-0' : 'text-red-400 shrink-0'} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white block truncate">{f.name}</span>
                                {imported && (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium shrink-0">
                                    Importado
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">
                                {f.size ? `${(Number(f.size) / 1024).toFixed(0)} KB` : ''}
                                {f.modifiedTime ? ` · ${new Date(f.modifiedTime).toLocaleDateString('es-CO')}` : ''}
                              </span>
                            </div>
                            {driveSelectedFile?.id === f.id && <Check size={14} className="text-blue-400 shrink-0" />}
                          </button>
                          )
                        })}
                        {driveFolders.length === 0 && driveFiles.length === 0 && (
                          <div className="text-xs text-slate-500 text-center py-6">Carpeta vacía</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Upload local ── */}
            {extractoSource === 'upload' && (
              <div>
                <label className="block text-xs text-slate-400 mb-2">Archivo PDF</label>
                <label className="flex items-center gap-2 px-4 py-3 bg-surface border border-dashed border-border rounded-lg cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors">
                  <Upload size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-300 truncate">
                    {extractoFile ? extractoFile.name : 'Seleccionar extracto PDF...'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => { setExtractoFile(e.target.files?.[0] || null); setExtractoTransactions([]); setExtractoMetadata({}); setExtractoError('') }}
                  />
                </label>
              </div>
            )}

            {/* Password */}
            <div className="max-w-xs">
              <label className="block text-xs text-slate-400 mb-2">Contraseña del PDF (si tiene)</label>
              <input
                type="password"
                value={extractoPassword}
                onChange={e => setExtractoPassword(e.target.value)}
                placeholder="Contraseña..."
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* Parse button */}
            <button
              onClick={extractoSource === 'drive' ? handleDriveParse : handleExtractoParse}
              disabled={
                extractoParsing ||
                (extractoSource === 'upload' && !extractoFile) ||
                (extractoSource === 'drive' && !driveSelectedFile)
              }
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/30 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {extractoParsing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {extractoParsing ? 'Procesando...' : 'Analizar Extracto'}
            </button>

            {extractoError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {extractoError}
              </div>
            )}

            {/* Metadata panel */}
            {Object.keys(extractoMetadata).length > 0 && (
              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: (EXTRACTO_ENTITIES[extractoEntity]?.color || '#3B82F6') + '40',
                  backgroundColor: (EXTRACTO_ENTITIES[extractoEntity]?.color || '#3B82F6') + '08',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={15} style={{ color: EXTRACTO_ENTITIES[extractoEntity]?.color }} />
                  <span className="text-sm font-semibold text-white">
                    {EXTRACTO_ENTITIES[extractoEntity]?.label || extractoEntity}
                  </span>
                  {extractoMetadata.cuenta && (
                    <span className="text-xs text-slate-400 font-mono ml-1">{extractoMetadata.cuenta}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {extractoMetadata.periodo && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Periodo</div>
                      <div className="text-xs text-slate-200 font-medium">{extractoMetadata.periodo}</div>
                    </div>
                  )}
                  {extractoMetadata.vencimiento && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Vencimiento</div>
                      <div className="text-xs text-amber-400 font-medium">{extractoMetadata.vencimiento}</div>
                    </div>
                  )}
                  {extractoMetadata.cupo_total && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Cupo Total</div>
                      <div className="text-xs text-slate-200 font-mono">{extractoMetadata.cupo_total}</div>
                    </div>
                  )}
                  {extractoMetadata.cupo_disponible && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Disponible</div>
                      <div className="text-xs text-emerald-400 font-mono">{extractoMetadata.cupo_disponible}</div>
                    </div>
                  )}
                  {extractoMetadata.total_pagar && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Total a Pagar</div>
                      <div className="text-xs text-red-400 font-mono font-semibold">{extractoMetadata.total_pagar}</div>
                    </div>
                  )}
                  {extractoMetadata.pago_minimo && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Pago Mínimo</div>
                      <div className="text-xs text-orange-400 font-mono">{extractoMetadata.pago_minimo}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview table */}
            {extractoTransactions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white">
                    {extractoTransactions.length} transacciones encontradas
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (extractoSelected.size === extractoTransactions.length) {
                          setExtractoSelected(new Set())
                        } else {
                          setExtractoSelected(new Set(extractoTransactions.map((_, i) => i)))
                        }
                      }}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      {extractoSelected.size === extractoTransactions.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </button>
                    <span className="text-xs text-slate-500">
                      {extractoSelected.size} seleccionadas
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface/80 text-slate-400">
                        <th className="px-3 py-2 text-left w-8"></th>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">Descripción</th>
                        <th className="px-3 py-2 text-right">Valor Total</th>
                        <th className="px-3 py-2 text-center">Cuotas</th>
                        <th className="px-3 py-2 text-right">Valor Cuota</th>
                        <th className="px-3 py-2 text-left">Entidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractoTransactions.map((t, i) => (
                        <tr
                          key={i}
                          className={`border-t border-border/50 transition-colors ${
                            extractoSelected.has(i) ? 'bg-blue-500/10' : 'hover:bg-white/3'
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={extractoSelected.has(i)}
                              onChange={() => {
                                const next = new Set(extractoSelected)
                                next.has(i) ? next.delete(i) : next.add(i)
                                setExtractoSelected(next)
                              }}
                              className="accent-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{t.FECHA}</td>
                          <td className="px-3 py-2 text-white max-w-[300px] truncate">{t.DESCRIPCION}</td>
                          <td className="px-3 py-2 text-right text-emerald-400 font-mono">
                            {formatCOPFull(t.VALOR)}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-400">{t.CUOTAS || '—'}</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono">
                            {t.VALOR_CUOTA ? formatCOPFull(t.VALOR_CUOTA) : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-300">{t.ENTIDAD}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total + Import button */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm text-slate-400">
                    Total seleccionado:{' '}
                    <span className="text-white font-semibold">
                      {formatCOPFull(
                        extractoTransactions
                          .filter((_, i) => extractoSelected.has(i))
                          .reduce((sum, t) => sum + (t.VALOR || 0), 0)
                      )}
                    </span>
                  </div>
                  <button
                    onClick={handleExtractoImport}
                    disabled={extractoSelected.size === 0 || extractoSaving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/30 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {extractoSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {extractoSaving ? 'Importando...' : `Importar ${extractoSelected.size} registros a Crédito`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Historial de importaciones */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Historial de Importaciones</h3>
                <p className="text-xs text-slate-500 mt-0.5">Extractos importados previamente</p>
              </div>
              <button
                onClick={loadExtractoImports}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw size={12} className={extractoImportsLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {extractoImports.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No hay importaciones registradas</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface/80 text-slate-400">
                      <th className="px-3 py-2 text-left">Entidad</th>
                      <th className="px-3 py-2 text-left">Periodo</th>
                      <th className="px-3 py-2 text-left">Archivo</th>
                      <th className="px-3 py-2 text-center">Txns</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractoImports.map((imp, i) => (
                      <tr key={imp.id || i} className="border-t border-border/50 hover:bg-white/3">
                        <td className="px-3 py-2 text-white font-medium">{imp.entity}</td>
                        <td className="px-3 py-2 text-slate-300">{imp.period}</td>
                        <td className="px-3 py-2 text-slate-300 max-w-[200px] truncate">{imp.file_name}</td>
                        <td className="px-3 py-2 text-center text-slate-400">{imp.transactions}</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-mono">
                          {formatCOPFull(imp.total_amount || 0)}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {imp.created_at ? new Date(imp.created_at).toLocaleDateString('es-CO') : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── History SubPage ──────────────────────────────────────────────── */}
      {activeSubPage === 'history' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Historial de Operaciones</h3>
              <p className="text-xs text-slate-500 mt-0.5">Registro de todas las acciones CRUD en finanzas</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={historyTab}
                onChange={e => setHistoryTab(e.target.value as TabKey | 'all')}
                className="bg-surface border border-border text-sm text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50"
              >
                <option value="all">Todas las pestañas</option>
                {TABS_CONFIG.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 bg-card border border-border px-3 py-2 rounded-lg transition-colors"
              >
                <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} />
                Actualizar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Cargando historial…</span>
              </div>
            ) : historyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-600">
                <AlertCircle size={24} />
                <span className="text-sm">Sin registros en el historial</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-slate-500 font-medium py-2 px-3">Acción</th>
                    <th className="text-left text-xs text-slate-500 font-medium py-2 px-3">Pestaña</th>
                    <th className="text-left text-xs text-slate-500 font-medium py-2 px-3">Datos</th>
                    <th className="text-left text-xs text-slate-500 font-medium py-2 px-3">Motivo</th>
                    <th className="text-left text-xs text-slate-500 font-medium py-2 px-3">Usuario</th>
                    <th className="text-left text-xs text-slate-500 font-medium py-2 px-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((h, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-white/3 transition-colors">
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          h.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : h.action === 'UPDATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : h.action === 'DELETE' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {h.action}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">{h.tab}</td>
                      <td className="py-2 px-3 text-slate-300 max-w-xs">
                        {(() => {
                          if (!h.data) return <span className="text-slate-600">—</span>
                          try {
                            const d = JSON.parse(h.data)
                            // UPDATE: show diff
                            if (h.action === 'UPDATE' && d.diff) {
                              return (
                                <div className="space-y-1">
                                  {Object.entries(d.diff).map(([key, change]: [string, any]) => (
                                    <div key={key} className="text-[11px]">
                                      <span className="text-slate-500">{key}:</span>{' '}
                                      <span className="text-red-400 line-through">{String(change.from)}</span>{' '}
                                      <span className="text-emerald-400">→ {String(change.to)}</span>
                                    </div>
                                  ))}
                                </div>
                              )
                            }
                            // DELETE: show deleted record name
                            if (h.action === 'DELETE' && d.deleted) {
                              const name = d.deleted.PRODUCT || d.deleted.PRODUCTO || d.deleted.NOMBRE || 'Registro'
                              return <span className="text-red-400 text-xs">🗑️ {name}</span>
                            }
                            // CREATE: show new record name
                            if (h.action === 'CREATE' && d.PRODUCT) return <span className="text-emerald-400 text-xs">✚ {d.PRODUCT}</span>
                            if (h.action === 'CREATE' && d.PRODUCTO) return <span className="text-emerald-400 text-xs">✚ {d.PRODUCTO}</span>
                            if (h.action === 'CREATE' && d.NOMBRE) return <span className="text-emerald-400 text-xs">✚ {d.NOMBRE}</span>
                            return <span className="text-slate-600 text-xs">—</span>
                          } catch {
                            return <span className="text-slate-600 text-xs">—</span>
                          }
                        })()}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs max-w-xs truncate" title={h.reason}>{h.reason || '—'}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{h.user_email || '—'}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{new Date(h.created_at).toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
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
                ? [...new Set([...TAB_COLUMNS[crudTab], ...Object.keys(records[0] || {})])]
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

      {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
      {showDeleteModal && deleteIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-danger/20 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-danger/10 border border-danger/20 rounded-xl flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Eliminar Registro</h3>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            {/* Preview del registro a eliminar */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
              <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wider">Registro seleccionado</p>
              <div className="space-y-1.5">
                {Object.entries(records[deleteIndex] || {}).slice(0, 5).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-slate-500">{key}</span>
                    <span className="text-slate-300 truncate max-w-[200px]" title={String(value)}>{String(value)}</span>
                  </div>
                ))}
                {Object.keys(records[deleteIndex] || {}).length > 5 && (
                  <p className="text-[10px] text-slate-600">+ {Object.keys(records[deleteIndex] || {}).length - 5} campos más</p>
                )}
              </div>
            </div>

            {/* Motivo de eliminación */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">
                Motivo de eliminación <span className="text-danger">*</span>
              </label>
              <textarea
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="Describe por qué eliminas este registro..."
                rows={3}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-danger/50 resize-none transition-colors"
              />
              <p className="text-[10px] text-slate-600 mt-1">
                Este motivo se guardará para auditoría.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteIndex(null); setDeleteReason('') }}
                disabled={deleteLoading}
                className="flex-1 py-2.5 text-sm text-slate-400 hover:text-white border border-border rounded-xl hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading || !deleteReason.trim()}
                className="flex-1 py-2.5 text-sm bg-danger hover:bg-danger/80 text-white rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Eliminar Registro
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Purchase Modal ──────────────────────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Agregar Compra</h3>
            <p className="text-xs text-slate-500">Llena los datos comunes una vez y agrega los productos de esta compra.</p>

            {/* Datos comunes */}
            <div className="p-4 rounded-xl border border-border bg-surface/50 space-y-3">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Datos de la compra</p>
              <div className="grid grid-cols-2 gap-3">
                {BULK_COMMON_FIELDS.map(col => (
                  <div key={col}>
                    <label className="text-xs text-slate-400 mb-1 block">{col}</label>
                    {renderFormField(col, bulkCommon[col] ?? '', val => setBulkCommon(prev => ({ ...prev, [col]: val })))}
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Productos ({bulkItems.length})</p>
                <button
                  onClick={() => setBulkItems(prev => [...prev, {}])}
                  className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
                >
                  + Agregar producto
                </button>
              </div>
              {bulkItems.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-border bg-surface/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Producto {idx + 1}</span>
                    {bulkItems.length > 1 && (
                      <button
                        onClick={() => setBulkItems(prev => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-danger hover:text-danger/80 transition-colors"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {BULK_ITEM_FIELDS.map(col => (
                      <div key={col} className={col === 'DESCRIPTION' ? 'col-span-2' : ''}>
                        <label className="text-xs text-slate-400 mb-1 block">{col}</label>
                        {renderFormField(col, item[col] ?? '', val =>
                          setBulkItems(prev => prev.map((it, i) => i === idx ? { ...it, [col]: val } : it))
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {bulkError && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm text-danger">{bulkError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-border">
              <button
                onClick={() => setShowBulkModal(false)}
                disabled={bulkSaving}
                className="flex-1 py-2 text-sm text-slate-400 hover:text-white border border-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkSave}
                disabled={bulkSaving}
                className="flex-1 py-2 text-sm bg-accent hover:bg-accent/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkSaving ? 'Guardando...' : `Crear ${bulkItems.filter(i => i['PRODUCT']).length} registro(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Shop Modal ──────────────────────────────────────────────── */}
      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Editar Compra</h3>
            <p className="text-xs text-slate-500">
              Los cambios se aplicarán a los {editingShop.indices.length} registros de esta compra.
            </p>

            <div className="space-y-3">
              {BULK_COMMON_FIELDS.map(col => (
                <div key={col}>
                  <label className="text-xs text-slate-400 mb-1 block">{col}</label>
                  {renderFormField(col, shopEditForm[col] ?? '', val => setShopEditForm(prev => ({ ...prev, [col]: val })))}
                </div>
              ))}
            </div>

            {shopEditError && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm text-danger">{shopEditError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-border">
              <button
                onClick={() => setEditingShop(null)}
                disabled={shopEditSaving}
                className="flex-1 py-2 text-sm text-slate-400 hover:text-white border border-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleShopEditSave}
                disabled={shopEditSaving}
                className="flex-1 py-2 text-sm bg-accent hover:bg-accent/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shopEditSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
