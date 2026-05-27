import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Rutas accesibles para usuarios de solo lectura */
const READONLY_ALLOWED = ['/backlog', '/health', '/certifications', '/rappi-prices', '/profile']

export function ProtectedRoute() {
  const { user, isLoading, isReadOnly } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07070F]">
        <div className="animate-pulse text-white/60">Cargando...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Usuarios de solo lectura: redirigir si intentan acceder a ruta restringida
  if (isReadOnly && !READONLY_ALLOWED.some(r => location.pathname.startsWith(r))) {
    return <Navigate to="/certifications" replace />
  }

  return <Outlet />
}