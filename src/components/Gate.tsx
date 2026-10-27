import { useEffect, useState } from 'react'
import { Contact, Loader2 } from 'lucide-react'
import { init, login, useAppState } from '../lib/store'

// Loads data from the server before rendering the app, and shows the sign-in form when needed.
export default function Gate({ children }: { children: React.ReactNode }) {
  const { status, loadError } = useAppState()

  useEffect(() => {
    init()
  }, [])

  if (status === 'ready') return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin text-slate-400" />}
      {status === 'login' && <LoginForm />}
      {status === 'error' && (
        <div className="card max-w-md p-6 text-center">
          <p className="font-semibold">Couldn't load your leads</p>
          <p className="mt-1 text-sm text-slate-500">{loadError}</p>
          <button className="btn-primary mt-4" onClick={() => init()}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function LoginForm() {
  const { setupNeeded, adminEmail } = useAppState()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="card w-full max-w-sm p-8"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          await login(email, password)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Sign-in failed')
          setBusy(false)
        }
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Contact className="h-6 w-6" />
        </div>
        <div className="leading-tight">
          <div className="font-semibold">LeadFlow</div>
          <div className="text-sm text-slate-400">Sales CRM</div>
        </div>
      </div>
      {setupNeeded && (
        <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No accounts exist yet. Set <code>ADMIN_PASSWORD</code> on the server to create the admin account for {adminEmail}.
        </p>
      )}
      <label htmlFor="login-email" className="label mt-6">Email</label>
      <input id="login-email" className="input" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="login-password" className="label mt-4">Password</label>
      <input
        id="login-password"
        className="input"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button className="btn-primary mt-5 w-full" disabled={busy || !email || !password}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
      </button>
    </form>
  )
}
