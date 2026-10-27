import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { replaceAllLeads, updateSettings, useLeads, useSettings } from '../lib/store'
import type { Lead } from '../lib/types'

export default function SettingsPage() {
  const settings = useSettings()
  const leads = useLeads()
  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(leads, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `leadflow-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = async (file: File | undefined) => {
    if (!file) return
    let data: unknown
    try {
      data = JSON.parse(await file.text())
      if (!Array.isArray(data)) throw new Error('not an array')
      if (!confirm(`Replace your ${leads.length} leads with ${data.length} leads from this backup?`)) return
    } catch {
      alert("That file doesn't look like a LeadFlow backup.")
      return
    }
    try {
      await replaceAllLeads(data as Lead[])
    } catch (e) {
      alert(`Restore failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

      <form
        className="card mt-8 space-y-5 p-6"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          try {
            await updateSettings({ ownerName: form.ownerName.trim(), calendlyUrl: form.calendlyUrl.trim() })
            setSaved(true)
            setTimeout(() => setSaved(false), 1500)
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        }}
      >
        <div>
          <label className="label">Your name</label>
          <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          <p className="mt-1.5 text-sm text-slate-400">Used in greetings and to sign email drafts.</p>
        </div>
        <div>
          <label className="label">Calendly link</label>
          <input
            className="input"
            placeholder="https://calendly.com/…"
            value={form.calendlyUrl}
            onChange={(e) => setForm({ ...form, calendlyUrl: e.target.value })}
          />
          <p className="mt-1.5 text-sm text-slate-400">Shown on each lead's meeting card and included in email drafts.</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          AI-written email drafts are {settings.aiEnabled ? <b>on</b> : <b>off</b>}.{' '}
          {settings.aiEnabled
            ? 'Drafts are written by Claude from each lead’s conversation history and notes.'
            : 'Set ANTHROPIC_API_KEY on the Railway service to turn them on. Until then drafts use a template.'}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary">{saved ? 'Saved' : 'Save settings'}</button>
      </form>

      <section className="card mt-6 p-6">
        <h2 className="section-title">Your data</h2>
        <p className="mt-2 text-sm text-slate-500">
          Leads are stored in your Postgres database, so they're the same on every device. Export a JSON backup any time.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={exportJson}>
            <Download className="h-4 w-4" /> Export backup
          </button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Restore backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              importJson(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </section>
    </div>
  )
}
