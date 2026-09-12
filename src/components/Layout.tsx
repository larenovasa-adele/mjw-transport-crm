import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/fleet', label: 'Fleet' },
  { to: '/staff', label: 'Staff' },
  { to: '/routes', label: 'Routes' },
  { to: '/tracker', label: 'Tracker' },
  { to: '/clients', label: 'Clients' },
  { to: '/finances', label: 'Finances' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white sm:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            MJW
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">MJW Transport</p>
            <p className="text-xs leading-tight text-slate-500">Operations CRM</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <p className="truncate px-2 text-xs text-slate-500">{user?.email}</p>
          <button
            onClick={() => signOut()}
            className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:hidden">
          <span className="font-semibold text-slate-900">MJW Transport CRM</span>
          <button onClick={() => signOut()} className="text-sm font-medium text-brand-600">
            Sign out
          </button>
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
