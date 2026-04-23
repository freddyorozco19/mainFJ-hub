import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Mail, Shield, KeyRound, Save, CheckCircle, AlertCircle } from 'lucide-react'

export function Profile() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSaving(true)
    // Simulación — en producción conectar con backend
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
    setMessage('Contraseña actualizada correctamente')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
        <p className="text-sm text-slate-500 mt-1">Gestiona tu cuenta y preferencias</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información del usuario */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <User size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{user?.name || 'Usuario'}</h3>
              <p className="text-sm text-slate-500">{user?.email || ''}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Email</label>
              <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2.5">
                <Mail size={14} className="text-slate-500" />
                <span className="text-sm text-slate-300">{user?.email || '—'}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">ID de usuario</label>
              <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2.5">
                <Shield size={14} className="text-slate-500" />
                <span className="text-sm text-slate-300 font-mono">{user?.id || '—'}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Rol</label>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20">
                  Administrador
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <KeyRound size={20} className="text-accent" />
            <h3 className="text-lg font-semibold text-white">Cambiar contraseña</h3>
          </div>

          {message && (
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
              <CheckCircle size={16} className="text-success" />
              <p className="text-sm text-success">{message}</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg">
              <AlertCircle size={16} className="text-danger" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Contraseña actual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50"
                placeholder="Repite la nueva contraseña"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? 'Guardando...' : <><Save size={14} /> Actualizar contraseña</>}
            </button>
          </form>
        </div>
      </div>

      {/* Preferencias */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Preferencias</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <div>
              <p className="text-sm text-white">Notificaciones del sistema</p>
              <p className="text-xs text-slate-500">Alertas de costos y eventos SSE</p>
            </div>
            <div className="w-11 h-6 bg-primary/30 rounded-full relative">
              <div className="w-4 h-4 bg-primary rounded-full absolute top-1 right-1" />
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <div>
              <p className="text-sm text-white">Auto-refresh de datos</p>
              <p className="text-xs text-slate-500">Actualizar automáticamente cada 30s</p>
            </div>
            <div className="w-11 h-6 bg-primary/30 rounded-full relative">
              <div className="w-4 h-4 bg-primary rounded-full absolute top-1 right-1" />
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-white">Versión</p>
              <p className="text-xs text-slate-500">MainFJ Hub v0.3.0</p>
            </div>
            <span className="text-xs text-slate-600">Actualizado: Abr 2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}
