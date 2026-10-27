import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Check, Copy, KeyRound, Loader2, Shuffle, Trash2, UserPlus, X } from 'lucide-react'
import { api } from '../lib/api'
import { useAppState } from '../lib/store'
import type { User } from '../lib/types'

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function formatWhen(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'
}

// Shown once after creating a user or resetting a password, so the admin can pass it on.
interface Credentials {
  title: string
  email: string
  password: string
}

export default function AdminPage() {
  const { user: me } = useAppState()
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState<User | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  useEffect(() => {
    api<User[]>('/users')
      .then(setUsers)
      .catch((e) => setError(e.message))
  }, [])

  if (me?.role !== 'admin') return <Navigate to="/" replace />

  const run = async (fn: () => Promise<void>) => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const setRole = (u: User, role: User['role']) =>
    run(async () => {
      const updated = await api<User>(`/users/${u.id}`, { method: 'PATCH', json: { role } })
      setUsers((list) => list!.map((x) => (x.id === u.id ? updated : x)))
    })

  const remove = (u: User) => {
    if (!confirm(`Remove ${u.name || u.email}? They will no longer be able to sign in.`)) return
    run(async () => {
      await api(`/users/${u.id}`, { method: 'DELETE' })
      setUsers((list) => list!.filter((x) => x.id !== u.id))
    })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 text-slate-500">Add people who can sign in to LeadFlow. Everyone shares the same leads.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" /> Add user
        </button>
      </div>

      {error && <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {credentials && <CredentialsCard creds={credentials} onClose={() => setCredentials(null)} />}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[15px]">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr>
              {['Name', 'Email', 'Role', 'Last sign-in', ''].map((h) => (
                <th key={h} className="px-5 py-3.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!users && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                </td>
              </tr>
            )}
            {users?.map((u) => {
              const isMe = u.id === me.id
              return (
                <tr key={u.id}>
                  <td className="px-5 py-4 font-medium">
                    {u.name || <span className="text-slate-400">—</span>}
                    {isMe && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
                  </td>
                  <td className="px-5 py-4">{u.email}</td>
                  <td className="px-5 py-4">
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                      value={u.role}
                      disabled={isMe}
                      title={isMe ? "You can't change your own role" : undefined}
                      onChange={(e) => setRole(u, e.target.value as User['role'])}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatWhen(u.lastLoginAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button className="btn-secondary px-3 py-1.5" onClick={() => setResetting(u)}>
                        <KeyRound className="h-4 w-4" /> Reset password
                      </button>
                      {!isMe && (
                        <button className="btn-danger px-2.5 py-1.5" title="Remove user" onClick={() => remove(u)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-slate-400">
        Admins can add and remove users. Members can use everything else: pipeline, leads, uploads and settings.
      </p>

      {adding && (
        <UserModal
          onClose={() => setAdding(false)}
          onCreated={(u, password) => {
            setUsers((list) => [...(list ?? []), u])
            setAdding(false)
            setCredentials({ title: `${u.name || u.email} can now sign in`, email: u.email, password })
          }}
        />
      )}
      {resetting && (
        <ResetModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={(password) => {
            setCredentials({ title: `New password for ${resetting.name || resetting.email}`, email: resetting.email, password })
            setResetting(null)
          }}
        />
      )}
    </div>
  )
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <input className="input font-mono" value={value} onChange={(e) => onChange(e.target.value)} minLength={8} required />
      <button type="button" className="btn-secondary shrink-0 px-3" title="Generate a password" onClick={() => onChange(generatePassword())}>
        <Shuffle className="h-4 w-4" />
      </button>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
      <div className="card w-full max-w-md p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function UserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: User, password: string) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<User['role']>('member')
  const [password, setPassword] = useState(generatePassword)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <Modal title="Add user" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            onCreated(await api<User>('/users', { method: 'POST', json: { name, email, role, password } }), password)
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setBusy(false)
          }
        }}
      >
        <div>
          <label className="label">Name</label>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as User['role'])}>
            <option value="member">Member — uses the CRM</option>
            <option value="admin">Admin — can also manage users</option>
          </select>
        </div>
        <div>
          <label className="label">Temporary password</label>
          <PasswordField value={password} onChange={setPassword} />
          <p className="mt-1.5 text-sm text-slate-400">At least 8 characters. They can change it in Settings.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add user'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ResetModal({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: (password: string) => void }) {
  const [password, setPassword] = useState(generatePassword)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={`Reset password for ${user.name || user.email}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            await api(`/users/${user.id}`, { method: 'PATCH', json: { password } })
            onDone(password)
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setBusy(false)
          }
        }}
      >
        <div>
          <label className="label">New password</label>
          <PasswordField value={password} onChange={setPassword} />
          <p className="mt-1.5 text-sm text-slate-400">They'll be signed out everywhere and need this password to sign back in.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset password'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CredentialsCard({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = `Sign in to LeadFlow at ${location.origin}\nEmail: ${creds.email}\nPassword: ${creds.password}`
  return (
    <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-emerald-900">{creds.title}</p>
          <p className="mt-0.5 text-sm text-emerald-800">Copy these details and send them securely. The password won't be shown again.</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-emerald-700 hover:bg-emerald-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-white px-4 py-3 font-mono text-sm text-slate-800">{text}</pre>
      <button
        className="btn-secondary mt-3"
        onClick={async () => {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy details'}
      </button>
    </div>
  )
}
