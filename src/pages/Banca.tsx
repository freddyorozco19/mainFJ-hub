import { useState, useEffect } from 'react'
import { api } from '../api'
import { Building2, Plus, RefreshCw, Trash2, X, Loader2, CreditCard, Layers } from 'lucide-react'

interface BelvoLink   { id: number; belvo_id: string; institution: string; status: string; created_at: string }
interface BelvoAccount { belvo_id: string; link_id: string; institution: string; name: string; type: string; currency: string; balance: number; credit_data: string | null; synced_at: string; bank: string }
interface BelvoTx     { belvo_id: string; account_id: string; amount: number; currency: string; description: string | null; category: string | null; type: string; status: string; value_date: string; installment_number: number | null; installment_total: number | null; merchant: string | null }
interface BelvoInstitution { id: string; name: string; country: string }


const COP = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export function Banca() {
  const [links, setLinks]         = useState<BelvoLink[]>([])
  const [accounts, setAccounts]   = useState<BelvoAccount[]>([])
  const [txs, setTxs]             = useState<BelvoTx[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState<string | null>(null)
  const [tab, setTab]             = useState<'cuentas' | 'movimientos' | 'cuotas'>('cuentas')
  const [filterAccount, setFilterAccount] = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [form, setForm]                 = useState({ institution: '', username: '', password: '' })
  const [connecting, setConnecting]     = useState(false)
  const [connectErr, setConnectErr]     = useState('')
  const [institutions, setInstitutions] = useState<BelvoInstitution[]>([])
  const [loadingInst, setLoadingInst]   = useState(false)

  const load = async () => {
    setLoading(true)
    const [l, a] = await Promise.all([
      api('/belvo/links').then(r => r.json()),
      api('/belvo/accounts').then(r => r.json()),
    ])
    setLinks(Array.isArray(l) ? l : [])
    setAccounts(Array.isArray(a) ? a : [])
    setLoading(false)
  }

  const loadTxs = async (accountId = '', cuotas = false) => {
    const params = new URLSearchParams()
    if (accountId) params.append('account_id', accountId)
    if (cuotas)    params.append('cuotas', 'true')
    const r = await api(`/belvo/transactions?${params}`)
    setTxs(await r.json())
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (tab === 'movimientos') loadTxs(filterAccount)
    if (tab === 'cuotas')      loadTxs(filterAccount, true)
  }, [tab, filterAccount])

  const openConnect = async () => {
    setShowModal(true)
    setLoadingInst(true)
    setConnectErr('')
    try {
      const r = await api('/belvo/institutions')
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail ?? JSON.stringify(data))
      setInstitutions(Array.isArray(data) ? data : [])
      if (!Array.isArray(data) || data.length === 0) {
        setConnectErr('No se encontraron instituciones. Verifica que las variables BELVO_SECRET_ID y BELVO_SECRET_PASSWORD estén configuradas en Render.')
      }
    } catch (e: any) {
      setConnectErr(`Error cargando instituciones: ${e.message}`)
      setInstitutions([])
    }
    finally { setLoadingInst(false) }
  }

  const connect = async (e: React.FormEvent) => {
    e.preventDefault()
    setConnecting(true); setConnectErr('')
    try {
      const r = await api('/belvo/links', { method: 'POST', body: form })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail ?? 'Error') }
      setShowModal(false); setForm({ institution: '', username: '', password: '' })
      await load()
    } catch (e: any) { setConnectErr(e.message) }
    finally { setConnecting(false) }
  }

  const syncAccounts = async (link: BelvoLink) => {
    setSyncing(`link-${link.id}`)
    await api(`/belvo/accounts/${link.id}`, { method: 'POST', body: {} })
    await load(); setSyncing(null)
  }

  const syncTxs = async (acc: BelvoAccount) => {
    setSyncing(acc.belvo_id)
    await api('/belvo/sync', { method: 'POST', body: { account_id: acc.belvo_id, days: 90 } })
    await loadTxs(filterAccount, tab === 'cuotas')
    setSyncing(null)
  }

  const deleteLink = async (link: BelvoLink) => {
    if (!confirm(`¿Eliminar conexión con ${link.institution}?`)) return
    await api(`/belvo/links/${link.id}`, { method: 'DELETE', body: {} })
    await load()
  }

  const totalBalance = accounts.reduce((a, acc) => a + acc.balance, 0)
  const cuotasActivas = txs.filter(t => t.installment_total && t.installment_total > 1)

  const tabCls = (t: string) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:text-white'}`

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  )

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 size={22} className="text-primary" /> Banca
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Conexión bancaria vía Belvo · Sandbox</p>
        </div>
        <button onClick={openConnect} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors">
          <Plus size={15} /> Conectar banco
        </button>
      </div>

      {/* KPIs */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Balance total',       value: COP(totalBalance),  color: 'text-white'   },
            { label: 'Cuentas conectadas',  value: accounts.length,    color: 'text-success' },
            { label: 'Bancos vinculados',   value: links.length,       color: 'text-primary' },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs text-slate-500 mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sin bancos */}
      {links.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center">
          <Building2 size={40} className="mx-auto mb-4 text-slate-700" />
          <p className="text-slate-400 font-medium mb-1">No hay bancos conectados</p>
          <p className="text-slate-600 text-sm mb-4">Conecta tu banco para ver saldos y movimientos</p>
          <button onClick={openConnect} className="px-4 py-2 bg-primary hover:bg-violet-500 text-white rounded-xl text-sm transition-colors">
            + Conectar primer banco
          </button>
        </div>
      ) : (
        <>
          {/* Bancos conectados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {links.map(link => (
              <div key={link.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Building2 size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{link.institution}</p>
                    <span className={`text-[10px] ${link.status === 'valid' ? 'text-success' : 'text-danger'}`}>● {link.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => syncAccounts(link)} disabled={syncing === `link-${link.id}`} className="p-2 text-slate-500 hover:text-white transition-colors" title="Sync cuentas">
                    <RefreshCw size={14} className={syncing === `link-${link.id}` ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => deleteLink(link)} className="p-2 text-slate-600 hover:text-danger transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button className={tabCls('cuentas')}      onClick={() => setTab('cuentas')}>🏦 Cuentas</button>
            <button className={tabCls('movimientos')}  onClick={() => setTab('movimientos')}>💸 Movimientos</button>
            <button className={tabCls('cuotas')}       onClick={() => setTab('cuotas')}>📋 Cuotas</button>
          </div>

          {/* Cuentas */}
          {tab === 'cuentas' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map(acc => {
                const credit = acc.credit_data ? JSON.parse(acc.credit_data) : null
                return (
                  <div key={acc.belvo_id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-primary" />
                        <div>
                          <p className="text-sm font-semibold text-white">{acc.name}</p>
                          <p className="text-[10px] text-slate-500">{acc.bank} · {acc.type}</p>
                        </div>
                      </div>
                      <button onClick={() => syncTxs(acc)} disabled={syncing === acc.belvo_id} className="text-slate-500 hover:text-white transition-colors p-1" title="Sync transacciones">
                        <RefreshCw size={13} className={syncing === acc.belvo_id ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <p className="text-[10px] text-slate-500 mb-0.5">Saldo disponible</p>
                      <p className="text-2xl font-bold text-white">{COP(acc.balance)}</p>
                    </div>
                    {credit && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {credit.credit_limit           && <div className="bg-surface rounded-lg p-2"><p className="text-slate-500 text-[10px]">Cupo total</p><p className="text-white font-medium">{COP(credit.credit_limit)}</p></div>}
                        {credit.available_credit_limit && <div className="bg-surface rounded-lg p-2"><p className="text-slate-500 text-[10px]">Disponible</p><p className="text-success font-medium">{COP(credit.available_credit_limit)}</p></div>}
                        {credit.minimum_payment        && <div className="bg-surface rounded-lg p-2"><p className="text-slate-500 text-[10px]">Pago mínimo</p><p className="text-warning font-medium">{COP(credit.minimum_payment)}</p></div>}
                        {credit.next_payment_date      && <div className="bg-surface rounded-lg p-2"><p className="text-slate-500 text-[10px]">Próximo pago</p><p className="text-accent font-medium">{credit.next_payment_date}</p></div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Movimientos */}
          {tab === 'movimientos' && (
            <div className="space-y-3">
              <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
                <option value="">Todas las cuentas</option>
                {accounts.map(a => <option key={a.belvo_id} value={a.belvo_id}>{a.name}</option>)}
              </select>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-surface">
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="text-left px-4 py-3">Fecha</th>
                      <th className="text-left px-4 py-3">Descripción</th>
                      <th className="text-left px-4 py-3">Categoría</th>
                      <th className="text-center px-4 py-3">Cuotas</th>
                      <th className="text-right px-4 py-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {txs.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-600 text-sm">Sin movimientos · Haz sync de una cuenta primero</td></tr>
                    ) : txs.map(tx => (
                      <tr key={tx.belvo_id} className="hover:bg-white/2">
                        <td className="px-4 py-3 text-xs text-slate-400">{tx.value_date}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-white truncate max-w-xs">{tx.description ?? '—'}</p>
                          {tx.merchant && <p className="text-[10px] text-slate-500">{tx.merchant}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{tx.category ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {tx.installment_total && tx.installment_total > 1
                            ? <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">{tx.installment_number}/{tx.installment_total}</span>
                            : <span className="text-slate-700">—</span>
                          }
                        </td>
                        <td className={`px-4 py-3 text-right text-sm font-mono font-medium ${tx.type === 'INFLOW' ? 'text-success' : 'text-danger'}`}>
                          {tx.type === 'INFLOW' ? '+' : '-'}{COP(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cuotas */}
          {tab === 'cuotas' && (
            <div className="space-y-3">
              {cuotasActivas.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center text-slate-600">
                  <Layers size={32} className="mx-auto mb-3 opacity-20" />
                  <p>Sin compras a cuotas detectadas</p>
                  <p className="text-xs mt-1">Haz sync de tus cuentas de tarjeta primero</p>
                </div>
              ) : (
                <>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                    <p className="text-sm text-primary/80">{cuotasActivas.length} cuota(s) activa(s) detectadas</p>
                    <p className="text-sm text-primary font-mono font-bold">{COP(cuotasActivas.reduce((a, t) => a + t.amount, 0))} / mes</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-surface">
                        <tr className="text-xs text-slate-500 uppercase">
                          <th className="text-left px-4 py-3">Compra</th>
                          <th className="text-center px-4 py-3">Cuota</th>
                          <th className="text-center px-4 py-3">Restantes</th>
                          <th className="text-right px-4 py-3">Valor cuota</th>
                          <th className="text-right px-4 py-3">Total restante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {cuotasActivas.map(tx => {
                          const restantes = (tx.installment_total ?? 0) - (tx.installment_number ?? 0)
                          const pct = tx.installment_total ? Math.round(((tx.installment_number ?? 0) / tx.installment_total) * 100) : 0
                          return (
                            <tr key={tx.belvo_id} className="hover:bg-white/2">
                              <td className="px-4 py-3">
                                <p className="text-sm text-white truncate max-w-[200px]">{tx.description ?? tx.merchant ?? '—'}</p>
                                <p className="text-[10px] text-slate-600">{tx.value_date}</p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-sm font-bold text-primary">{tx.installment_number}/{tx.installment_total}</span>
                                  <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-slate-400">{restantes}</td>
                              <td className="px-4 py-3 text-right text-sm font-mono text-white">{COP(tx.amount)}</td>
                              <td className="px-4 py-3 text-right text-sm font-mono text-danger">{COP(tx.amount * restantes)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal conectar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-lg font-bold text-white">Conectar banco</h2>
              <button onClick={() => { setShowModal(false); setConnectErr(''); setInstitutions([]) }} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={connect} className="px-6 py-5 space-y-4">
              <div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-2.5 text-xs text-accent space-y-1">
                <p>Modo Sandbox · institución: <code>erebus_co_retail</code></p>
                <p>Usuario: <code>bnk:sandbox</code> · Contraseña: <code>full</code></p>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Institución</label>
                {institutions.length > 0 ? (
                  <select required value={form.institution} onChange={e => setForm({...form, institution: e.target.value})}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
                    <option value="">Seleccionar...</option>
                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name} ({i.country})</option>)}
                  </select>
                ) : (
                  <input required value={form.institution} onChange={e => setForm({...form, institution: e.target.value})}
                    placeholder="Ej: erebus_co_retail"
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary" />
                )}
                {loadingInst && <p className="text-[10px] text-slate-500 mt-1">Cargando instituciones disponibles...</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Usuario del banco</label>
                <input required value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                  placeholder="bnk:sandbox" className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Contraseña del banco</label>
                <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  placeholder="full" className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary" />
              </div>
              {connectErr && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{connectErr}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setConnectErr('') }} className="px-4 py-2 border border-border rounded-xl text-slate-300 hover:bg-white/5 text-sm">Cancelar</button>
                <button type="submit" disabled={connecting} className="px-4 py-2 bg-primary hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2">
                  {connecting && <Loader2 size={13} className="animate-spin" />} Conectar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
