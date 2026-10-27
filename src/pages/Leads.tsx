import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Plus, Search } from 'lucide-react'
import { addLeads, newLead, useLeads } from '../lib/store'
import type { StageId } from '../lib/types'
import { STAGES } from '../lib/types'
import type { FollowUpBucket } from '../lib/dates'
import { FOLLOW_UP_BUCKETS, followUpBucket, formatDate } from '../lib/dates'
import { FollowUpBadge, StageBadge } from '../components/Badges'
import LeadFormModal from '../components/LeadFormModal'

export default function LeadsPage() {
  const leads = useLeads()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [stage, setStage] = useState<StageId | ''>('')
  const [bucket, setBucket] = useState<FollowUpBucket | ''>('')
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return leads.filter(
      (l) =>
        (!stage || l.stage === stage) &&
        (!bucket || followUpBucket(l.nextFollowUp) === bucket) &&
        (!term || [l.name, l.company, l.email, l.title].some((f) => f.toLowerCase().includes(term))),
    )
  }, [leads, q, stage, bucket])

  const dash = <span className="text-slate-400">—</span>

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-slate-500">
            {leads.length} total leads{filtered.length !== leads.length && ` · ${filtered.length} shown`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add lead
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search name, company, email..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-56" value={stage} onChange={(e) => setStage(e.target.value as StageId | '')}>
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select className="input sm:w-56" value={bucket} onChange={(e) => setBucket(e.target.value as FollowUpBucket | '')}>
          <option value="">All follow-ups</option>
          {FOLLOW_UP_BUCKETS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[15px]">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr>
              {['Name', 'Company', 'Title', 'Email', 'LinkedIn', 'Stage', 'Follow-up', 'Meeting'].map((h) => (
                <th key={h} className="px-5 py-3.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  {leads.length === 0 ? 'No leads yet — add one or upload a CSV.' : 'No leads match your filters.'}
                </td>
              </tr>
            )}
            {filtered.map((l) => (
              <tr key={l.id} onClick={() => navigate(`/leads/${l.id}`)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-5 py-4 font-medium">{l.name}</td>
                <td className="px-5 py-4">{l.company || dash}</td>
                <td className="px-5 py-4">{l.title || dash}</td>
                <td className="px-5 py-4">{l.email || dash}</td>
                <td className="px-5 py-4">
                  {l.linkedin ? (
                    <a
                      href={l.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900"
                    >
                      Profile <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    dash
                  )}
                </td>
                <td className="px-5 py-4">
                  <StageBadge stage={l.stage} />
                </td>
                <td className="px-5 py-4">
                  <FollowUpBadge date={l.nextFollowUp} />
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {l.meetingBooked && l.meetingDate ? (
                    <span className="font-medium text-violet-700">{formatDate(l.meetingDate)}</span>
                  ) : (
                    'Not booked'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <LeadFormModal
          title="Add lead"
          onClose={() => setAdding(false)}
          onSave={(v) => {
            const lead = newLead(v)
            addLeads([lead])
            navigate(`/leads/${lead.id}`)
          }}
        />
      )}
    </div>
  )
}
