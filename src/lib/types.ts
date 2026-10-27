export const STAGES = [
  { id: 'new', label: 'New Lead', badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-300' },
  { id: 'conversation', label: 'In Conversation', badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-300' },
  { id: 'followup', label: 'Follow-Up Needed', badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-300' },
  { id: 'linkedin', label: 'Follow Up in LinkedIn', badge: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-300' },
  { id: 'meeting', label: 'Meeting Booked', badge: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-300' },
  { id: 'won', label: 'Client', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-300' },
  { id: 'lost', label: 'Not Interested', badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-300' },
] as const

export type StageId = (typeof STAGES)[number]['id']

export function stageInfo(id: StageId) {
  return STAGES.find((s) => s.id === id) ?? STAGES[0]
}

export interface Message {
  id: string
  date: string // YYYY-MM-DD
  direction: 'sent' | 'received'
  text: string
}

export interface Note {
  id: string
  createdAt: string // ISO timestamp
  text: string
}

export interface Lead {
  id: string
  name: string
  company: string
  title: string
  email: string
  linkedin: string
  stage: StageId
  nextFollowUp: string // YYYY-MM-DD or ''
  lastContact: string // YYYY-MM-DD or ''
  nextAction: string
  summary: string
  messages: Message[]
  notes: Note[]
  meetingDate: string // YYYY-MM-DD or ''
  meetingTime: string // HH:MM or ''
  meetingBooked: boolean
  createdAt: string
  updatedAt: string
}

export interface Settings {
  ownerName: string
  calendlyUrl: string
  aiEnabled: boolean // true when the server has ANTHROPIC_API_KEY set
}

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'member'
  createdAt: string
  lastLoginAt: string | null
}
