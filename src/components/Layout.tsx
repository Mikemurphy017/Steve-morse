import { NavLink, Outlet } from 'react-router-dom'
import { Columns3, Contact, Home, LogOut, Settings, Table, Upload, X } from 'lucide-react'
import { dismissSaveError, useAppState } from '../lib/store'
import { api } from '../lib/api'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/pipeline', label: 'Pipeline', icon: Columns3 },
  { to: '/leads', label: 'Leads', icon: Table },
  { to: '/upload', label: 'Upload Leads', icon: Upload },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
        <Contact className="h-6 w-6" />
      </div>
      <div className="leading-tight">
        <div className="font-semibold text-slate-900">LeadFlow</div>
        <div className="text-sm text-slate-400">Sales CRM</div>
      </div>
    </div>
  )
}

async function signOut() {
  await api('/logout', { method: 'POST' })
  location.reload()
}

export default function Layout() {
  const { saveError, passwordRequired } = useAppState()
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-6 py-6">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        {passwordRequired && (
        <button onClick={signOut} className="m-3 flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-slate-500 hover:bg-slate-100">
          <LogOut className="h-5 w-5" /> Sign out
        </button>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white md:hidden">
        <div className="px-4 py-3">
          <Brand />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        {saveError && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="flex-1">Couldn't save your last change: {saveError}. Check your connection and try again.</span>
            <button onClick={dismissSaveError} className="rounded p-1 hover:bg-red-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
