import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const authEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true'
  
  if (!authEnabled) {
    return <Outlet />
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07070F]">
        <div className="animate-pulse text-white/60">Cargando...</div>
      </div>
    )
  }
  
  if (!user) {
    return <Outlet />
  }
  
  return <Outlet />
}