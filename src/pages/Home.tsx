import { Link } from 'react-router-dom'
import { AlertCircle, CalendarCheck, CalendarClock, Users } from 'lucide-react'
import { useLeads, useSettings } from '../lib/store'
import { STAGES } from '../lib/types'
import { daysFromToday, followUpBucket, formatDate, formatTime, todayISO } from '../lib/dates'
import { FollowUpBadge, StageBadge } from '../components/Badges'

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Users; tone: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`rounded-lg p-2 ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  )
}

export default function HomePage() {
  const leads = useLeads()
  const settings = useSettings()
  const active = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost')

  const overdue = active.filter((l) => followUpBucket(l.nextFollowUp) === 'overdue')
  const dueSoon = active.filter((l) => ['today', 'week'].includes(followUpBucket(l.nextFollowUp)))
  const meetings = leads
    .filter((l) => l.meetingBooked && l.meetingDate && daysFromToday(l.meetingDate) >= 0)
    .sort((a, b) => (a.meetingDate + a.meetingTime).localeCompare(b.meetingDate + b.meetingTime))

  const attention = [...overdue, ...dueSoon].sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp))
  const maxStage = Math.max(1, ...STAGES.map((s) => leads.filter((l) => l.stage === s.id).length))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight">
        {greeting}, {settings.ownerName}
      </h1>
      <p className="mt-1 text-slate-500">
        {formatDate(todayISO())} · Here's what needs your attention.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total leads" value={leads.length} icon={Users} tone="bg-slate-100 text-slate-700" />
        <Stat label="Overdue follow-ups" value={overdue.length} icon={AlertCircle} tone="bg-red-50 text-red-600" />
        <Stat label="Due this week" value={dueSoon.length} icon={CalendarClock} tone="bg-amber-50 text-amber-600" />
        <Stat label="Upcoming meetings" value={meetings.length} icon={CalendarCheck} tone="bg-violet-50 text-violet-600" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <h2 className="section-title">Follow-ups to do</h2>
          {attention.length === 0 ? (
            <p className="mt-4 text-sm italic text-slate-400">Nothing due this week. 🎉</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {attention.slice(0, 12).map((l) => (
                <li key={l.id}>
                  <Link to={`/leads/${l.id}`} className="-mx-3 flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.name}</div>
                      <div className="truncate text-sm text-slate-500">
                        {l.nextAction || [l.title, l.company].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <span className="hidden text-sm text-slate-500 sm:inline">{formatDate(l.nextFollowUp)}</span>
                    <FollowUpBadge date={l.nextFollowUp} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {attention.length > 12 && (
            <Link to="/leads" className="mt-3 inline-block text-sm font-medium text-slate-600 hover:text-slate-900">
              View all {attention.length} →
            </Link>
          )}
        </section>

        <section className="card p-6">
          <h2 className="section-title">Upcoming meetings</h2>
          {meetings.length === 0 ? (
            <p className="mt-4 text-sm italic text-slate-400">No meetings booked yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {meetings.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <Link to={`/leads/${l.id}`} className="block rounded-xl border border-violet-100 bg-violet-50/60 p-3 hover:bg-violet-50">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-sm text-violet-700">
                      {formatDate(l.meetingDate)}
                      {l.meetingTime && ` · ${formatTime(l.meetingTime)}`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Pipeline</h2>
          <Link to="/pipeline" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            Open board →
          </Link>
        </div>
        <div className="mt-5 space-y-3">
          {STAGES.map((s) => {
            const n = leads.filter((l) => l.stage === s.id).length
            return (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-44 shrink-0">
                  <StageBadge stage={s.id} />
                </div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${s.dot}`} style={{ width: `${(n / maxStage) * 100}%` }} />
                </div>
                <div className="w-10 text-right text-sm font-medium tabular-nums text-slate-600">{n}</div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
