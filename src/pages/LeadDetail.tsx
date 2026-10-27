import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { deleteLead, draftEmail, uid, updateLead, useLead, useSettings } from '../lib/store'
import type { Lead, Message, StageId } from '../lib/types'
import { STAGES } from '../lib/types'
import { followUpBucket, todayISO } from '../lib/dates'
import { StageBadge } from '../components/Badges'
import LeadFormModal from '../components/LeadFormModal'

export default function LeadDetailPage() {
  const { id } = useParams()
  const lead = useLead(id)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  if (!lead) {
    return (
      <div className="mx-auto max-w-5xl">
        <BackLink />
        <p className="mt-10 text-slate-500">This lead doesn't exist (it may have been deleted).</p>
      </div>
    )
  }

  const patch = (p: Partial<Lead>) => updateLead(lead.id, p)
  const overdue = followUpBucket(lead.nextFollowUp) === 'overdue'

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink />

      <section className="card mt-5 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{lead.name}</h1>
              <StageBadge stage={lead.stage} size="md" />
            </div>
            {lead.title && <p className="mt-1 text-lg text-slate-500">{lead.title}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-slate-500">
              {lead.company && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" /> {lead.company}
                </span>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:text-slate-900">
                  <Mail className="h-4 w-4" /> {lead.email}
                </a>
              )}
              {lead.linkedin && (
                <a href={lead.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-slate-900">
                  <Link2 className="h-4 w-4" /> LinkedIn <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button
              className="btn-danger px-3"
              title="Delete lead"
              onClick={() => {
                if (confirm(`Delete ${lead.name}? This can't be undone.`)) {
                  deleteLead(lead.id)
                  navigate('/leads')
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 border-t border-slate-100 pt-6 md:grid-cols-3">
          <div>
            <label className="label">Stage</label>
            <select className="input" value={lead.stage} onChange={(e) => patch({ stage: e.target.value as StageId })}>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Next follow-up</label>
            <input className="input" type="date" value={lead.nextFollowUp} onChange={(e) => patch({ nextFollowUp: e.target.value })} />
            {overdue && <p className="mt-1.5 text-sm font-medium text-red-600">Overdue</p>}
          </div>
          <div>
            <label className="label">Last contact</label>
            <input className="input" type="date" value={lead.lastContact} onChange={(e) => patch({ lastContact: e.target.value })} />
          </div>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label className="label">Next action needed</label>
            <input
              className="input"
              placeholder="e.g. Send calendar link"
              value={lead.nextAction}
              onChange={(e) => patch({ nextAction: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Conversation summary</label>
            <textarea
              className="input min-h-[84px]"
              placeholder="Where things stand…"
              value={lead.summary}
              onChange={(e) => patch({ summary: e.target.value })}
            />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card p-6">
          <Conversation lead={lead} />
          <Notes lead={lead} />
        </section>
        <div className="space-y-6">
          <MeetingCard lead={lead} />
          <EmailDraftCard lead={lead} />
        </div>
      </div>

      {editing && (
        <LeadFormModal
          title="Edit lead"
          initial={lead}
          onClose={() => setEditing(false)}
          onSave={(v) => {
            patch(v)
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/pipeline" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" /> Back to pipeline
    </Link>
  )
}

function Conversation({ lead }: { lead: Lead }) {
  const [date, setDate] = useState(todayISO())
  const [direction, setDirection] = useState<Message['direction']>('sent')
  const [text, setText] = useState('')
  const messages = lead.messages.slice().sort((a, b) => b.date.localeCompare(a.date))

  const add = () => {
    if (!text.trim()) return
    updateLead(lead.id, {
      messages: [...lead.messages, { id: uid(), date, direction, text: text.trim() }],
      lastContact: !lead.lastContact || date > lead.lastContact ? date : lead.lastContact,
    })
    setText('')
  }

  return (
    <>
      <h2 className="section-title">
        <MessageSquare className="h-5 w-5" /> Conversation history
      </h2>
      <div className="mt-4 space-y-3">
        {messages.length === 0 && <p className="text-sm italic text-slate-400">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className="group flex gap-3 rounded-xl bg-slate-50 p-4">
            {m.direction === 'sent' ? (
              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ArrowDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-400">
                {m.date} · {m.direction}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-slate-800">{m.text}</p>
            </div>
            <button
              className="h-fit rounded p-1 text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
              title="Delete message"
              onClick={() => updateLead(lead.id, { messages: lead.messages.filter((x) => x.id !== m.id) })}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <div className="flex gap-3">
          <input className="input w-44" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="input w-32" value={direction} onChange={(e) => setDirection(e.target.value as Message['direction'])}>
            <option value="sent">Sent</option>
            <option value="received">Received</option>
          </select>
        </div>
        <textarea
          className="input mt-3 min-h-[100px]"
          placeholder="Paste a LinkedIn message here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary mt-3" disabled={!text.trim()} onClick={add}>
          <Plus className="h-4 w-4" /> Add message
        </button>
      </div>
    </>
  )
}

function Notes({ lead }: { lead: Lead }) {
  const [text, setText] = useState('')
  const notes = lead.notes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const add = () => {
    if (!text.trim()) return
    updateLead(lead.id, { notes: [...lead.notes, { id: uid(), createdAt: new Date().toISOString(), text: text.trim() }] })
    setText('')
  }
  return (
    <div className="mt-8">
      <h2 className="section-title">
        <StickyNote className="h-5 w-5" /> Notes
      </h2>
      <div className="mt-3 space-y-2">
        {notes.length === 0 && <p className="text-sm italic text-slate-400">No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="group flex gap-3 rounded-xl bg-amber-50/60 p-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px]">{n.text}</p>
            </div>
            <button
              className="h-fit rounded p-1 text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
              title="Delete note"
              onClick={() => updateLead(lead.id, { notes: lead.notes.filter((x) => x.id !== n.id) })}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <textarea className="input min-h-[80px]" placeholder="Add a note..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-secondary mt-3" disabled={!text.trim()} onClick={add}>
          <Plus className="h-4 w-4" /> Add note
        </button>
      </div>
    </div>
  )
}

function MeetingCard({ lead }: { lead: Lead }) {
  const settings = useSettings()
  const [date, setDate] = useState(lead.meetingDate)
  const [time, setTime] = useState(lead.meetingTime)
  const [booked, setBooked] = useState(lead.meetingBooked)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDate(lead.meetingDate)
    setTime(lead.meetingTime)
    setBooked(lead.meetingBooked)
  }, [lead.id, lead.meetingDate, lead.meetingTime, lead.meetingBooked])

  const dirty = date !== lead.meetingDate || time !== lead.meetingTime || booked !== lead.meetingBooked

  return (
    <section className="card p-6">
      <h2 className="section-title">
        <Calendar className="h-5 w-5 text-violet-600" /> Meeting
      </h2>
      {settings.calendlyUrl && (
        <a
          href={settings.calendlyUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 hover:bg-violet-100"
        >
          Open {settings.ownerName}'s Calendly <ExternalLink className="h-4 w-4" />
        </a>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date</label>
          <input className="input px-2.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Time</label>
          <input className="input px-2.5" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[15px] text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-slate-900" checked={booked} onChange={(e) => setBooked(e.target.checked)} />
        Meeting is booked
      </label>
      <button
        className="btn-primary mt-4 w-full"
        disabled={!dirty}
        onClick={() => {
          updateLead(lead.id, {
            meetingDate: date,
            meetingTime: time,
            meetingBooked: booked,
            ...(booked && lead.stage !== 'won' ? { stage: 'meeting' as const } : {}),
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 1500)
        }}
      >
        <Check className="h-4 w-4" /> {saved ? 'Saved' : 'Save meeting'}
      </button>
    </section>
  )
}

function EmailDraftCard({ lead }: { lead: Lead }) {
  const settings = useSettings()
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await draftEmail(lead.id)
      setDraft(res.draft)
      if (res.error) setError(res.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const mailto = () => {
    const m = draft.match(/^Subject:\s*(.*)\n+/i)
    const subject = m ? m[1] : 'Following up'
    const body = m ? draft.slice(m[0].length) : draft
    return `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="section-title">
          <Sparkles className="h-5 w-5 text-violet-500" /> Follow-up email draft
        </h2>
        <button className="btn-primary shrink-0 px-3 py-2" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {draft ? 'Redraft' : 'Draft email'}
        </button>
      </div>
      {!draft && (
        <p className="mt-3 text-sm italic text-slate-400">
          Generate a personalized follow-up email based on {lead.name}'s conversation history and notes.
          {!settings.aiEnabled && ' (Uses a template until ANTHROPIC_API_KEY is set on the server.)'}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {draft && (
        <>
          <textarea className="input mt-4 min-h-[260px] text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={async () => {
                await navigator.clipboard.writeText(draft)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <a className="btn-secondary flex-1" href={mailto()}>
              <Mail className="h-4 w-4" /> Open in mail
            </a>
          </div>
        </>
      )}
    </section>
  )
}
