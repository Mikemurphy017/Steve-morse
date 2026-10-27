import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { addLeads, newLead, updateLead, useLeads } from '../lib/store'
import type { StageId } from '../lib/types'
import { STAGES } from '../lib/types'
import { FollowUpBadge, StageBadge } from '../components/Badges'
import LeadFormModal from '../components/LeadFormModal'

export default function PipelinePage() {
  const leads = useLeads()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<StageId | null>(null)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-slate-500">Drag cards between stages to update your leads.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add lead
        </button>
      </div>

      <div className="mt-8 flex gap-5 overflow-x-auto pb-4">
        {STAGES.map((s) => {
          const items = leads.filter((l) => l.stage === s.id)
          return (
            <div
              key={s.id}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(s.id)
              }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain') || dragId
                if (id) updateLead(id, { stage: s.id })
                setDragId(null)
                setOver(null)
              }}
              className={`flex max-h-[calc(100vh-13rem)] w-80 shrink-0 flex-col rounded-2xl bg-slate-100/70 p-3 transition ${
                over === s.id ? 'ring-2 ring-slate-300' : ''
              }`}
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                <span className="flex-1 font-semibold">{s.label}</span>
                <span className="rounded-full bg-white px-2 text-sm text-slate-500">{items.length}</span>
              </div>
              <div className="mt-2 flex-1 space-y-3 overflow-y-auto">
                {items.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No leads</p>}
                {items.map((l) => (
                  <Link
                    key={l.id}
                    to={`/leads/${l.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', l.id)
                      setDragId(l.id)
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={`block cursor-grab rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 active:cursor-grabbing ${
                      dragId === l.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{l.name}</span>
                      <StageBadge stage={l.stage} />
                    </div>
                    {l.nextAction && (
                      <div className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{l.nextAction}</div>
                    )}
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <FollowUpBadge date={l.nextFollowUp} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
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
