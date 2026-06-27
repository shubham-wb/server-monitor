import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Server,
  Database,
  ClipboardList,
  AlertTriangle,
  Ticket,
  Terminal,
  Settings,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/servers', icon: Server, label: 'Remote Servers' },
  { to: '/log-sources', icon: Database, label: 'Log Sources' },
  { to: '/jobs', icon: ClipboardList, label: 'Analysis Jobs' },
  { to: '/anomalies', icon: AlertTriangle, label: 'Anomalies' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/monitor', icon: Terminal, label: 'Log Monitor' },
]

export function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#080c14]">
      {/* Sidebar */}
      <aside className="flex h-full w-56 flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#080c14]">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/[0.06] px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-100">ServerMonitor</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 pt-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 font-medium'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                )
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Settings */}
        <div className="border-t border-white/[0.06] p-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-blue-600/15 text-blue-400 font-medium'
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
              )
            }
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
