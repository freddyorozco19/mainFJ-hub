import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="min-h-screen bg-[#07070F] flex">
      <Sidebar />
      <main className="ml-56 flex-1 min-h-screen flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
