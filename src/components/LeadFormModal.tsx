import { useState } from 'react'
import { X } from 'lucide-react'
import type { Lead, StageId } from '../lib/types'
import { STAGES } from '../lib/types'

export interface LeadFormValues {
  name: string
  title: string
  company: string
  email: string
  linkedin: string
  stage: StageId
}

export default function LeadFormModal({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial?: Partial<Lead>
  title: string
  onClose: () => void
  onSave: (v: LeadFormValues) => void
}) {
  const [v, setV] = useState<LeadFormValues>({
    name: initial?.name ?? '',
    title: initial?.title ?? '',
    company: initial?.company ?? '',
    email: initial?.email ?? '',
    linkedin: initial?.linkedin ?? '',
    stage: initial?.stage ?? 'new',
  })
  const set = (k: keyof LeadFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
      <form
        className="card w-full max-w-lg p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (v.name.trim()) onSave({ ...v, name: v.name.trim() })
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Name *</label>
            <input className="input" autoFocus required value={v.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">Job title</label>
            <input className="input" value={v.title} onChange={set('title')} />
          </div>
          <div>
            <label className="label">Company</label>
            <input className="input" value={v.company} onChange={set('company')} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={v.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label">Stage</label>
            <select className="input" value={v.stage} onChange={set('stage')}>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">LinkedIn URL</label>
            <input className="input" placeholder="https://linkedin.com/in/…" value={v.linkedin} onChange={set('linkedin')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  )
}
