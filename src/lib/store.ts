import { useSyncExternalStore } from 'react'
import type { Lead, Settings } from './types'
import { api, ApiError } from './api'

// Leads saved by the earlier browser-only version of the app; uploaded once, then cleared.
const LEGACY_LEADS_KEY = 'leadflow.leads.v1'

const DEFAULT_SETTINGS: Settings = {
  ownerName: 'Steve',
  calendlyUrl: 'https://calendly.com/steve-morse-seatonhill',
  aiEnabled: false,
}

export type Status = 'loading' | 'login' | 'ready' | 'error'

interface State {
  status: Status
  loadError: string
  passwordRequired: boolean
  saveError: string
  leads: Lead[]
  settings: Settings
}

let state: State = { status: 'loading', loadError: '', passwordRequired: false, saveError: '', leads: [], settings: DEFAULT_SETTINGS }
const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function reportSaveError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) return set({ status: 'login' })
  set({ saveError: e instanceof Error ? e.message : String(e) })
}

export function useAppState() {
  return useSyncExternalStore(subscribe, () => state)
}

export function useLeads(): Lead[] {
  return useSyncExternalStore(subscribe, () => state.leads)
}

export function useLead(id: string | undefined): Lead | undefined {
  return useLeads().find((l) => l.id === id)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => state.settings)
}

export function dismissSaveError() {
  set({ saveError: '' })
}

// --- Loading & auth -----------------------------------------------------------

export async function init() {
  set({ status: 'loading', loadError: '' })
  try {
    const session = await api<{ authenticated: boolean; passwordRequired: boolean }>('/session')
    set({ passwordRequired: session.passwordRequired })
    if (!session.authenticated) return set({ status: 'login' })
    const [leads, settings] = await Promise.all([api<Lead[]>('/leads'), api<Partial<Settings>>('/settings')])
    set({ status: 'ready', leads, settings: { ...DEFAULT_SETTINGS, ...settings } })
    await migrateLegacyLeads()
  } catch (e) {
    set({ status: 'error', loadError: e instanceof Error ? e.message : String(e) })
  }
}

export async function login(password: string) {
  await api('/login', { method: 'POST', json: { password } })
  await init()
}

async function migrateLegacyLeads() {
  let legacy: Lead[] = []
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_LEADS_KEY) || '[]')
  } catch {
    /* ignore unreadable legacy data */
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return
  const known = new Set(state.leads.map((l) => l.id))
  const fresh = legacy.filter((l) => !known.has(l.id))
  if (fresh.length) {
    const saved = await api<Lead[]>('/leads', { method: 'POST', json: fresh })
    set({ leads: [...saved, ...state.leads] })
  }
  localStorage.removeItem(LEGACY_LEADS_KEY)
}

// --- Leads ----------------------------------------------------------------------

export function uid(): string {
  return crypto.randomUUID()
}

export type LeadInput = Partial<Lead> & { name: string }

export function newLead(input: LeadInput): Lead {
  const now = new Date().toISOString()
  return {
    company: '',
    title: '',
    email: '',
    linkedin: '',
    stage: 'new',
    nextFollowUp: '',
    lastContact: '',
    nextAction: '',
    summary: '',
    messages: [],
    notes: [],
    meetingDate: '',
    meetingTime: '',
    meetingBooked: false,
    ...input,
    id: input.id ?? uid(),
    createdAt: now,
    updatedAt: now,
  }
}

export async function addLeads(items: Lead[]) {
  set({ leads: [...items, ...state.leads] })
  try {
    await api('/leads', { method: 'POST', json: items })
  } catch (e) {
    const ids = new Set(items.map((l) => l.id))
    set({ leads: state.leads.filter((l) => !ids.has(l.id)) })
    reportSaveError(e)
    throw e
  }
}

// Edits are applied locally right away and sent to the server in batches, so typing
// in a text field doesn't fire a request per keystroke.
const pending = new Map<string, Partial<Lead>>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

async function flush(id: string) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  const patch = pending.get(id)
  pending.delete(id)
  if (!patch) return
  try {
    await api(`/leads/${id}`, { method: 'PATCH', json: patch })
  } catch (e) {
    reportSaveError(e)
  }
}

export function updateLead(id: string, patch: Partial<Lead>) {
  set({ leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l)) })
  pending.set(id, { ...pending.get(id), ...patch })
  clearTimeout(timers.get(id))
  timers.set(id, setTimeout(() => flush(id), 500))
}

window.addEventListener('pagehide', () => {
  for (const [id, patch] of pending) {
    fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
      keepalive: true,
    })
  }
  pending.clear()
})

export async function deleteLead(id: string) {
  const before = state.leads
  pending.delete(id)
  clearTimeout(timers.get(id))
  set({ leads: before.filter((l) => l.id !== id) })
  try {
    await api(`/leads/${id}`, { method: 'DELETE' })
  } catch (e) {
    set({ leads: before })
    reportSaveError(e)
  }
}

export async function replaceAllLeads(items: Lead[]) {
  const saved = await api<Lead[]>('/leads', { method: 'PUT', json: items })
  set({ leads: saved })
}

export async function draftEmail(id: string) {
  await flush(id)
  return api<{ draft: string; source: 'ai' | 'template'; error?: string }>(`/leads/${id}/draft-email`, { method: 'POST' })
}

// --- Settings ---------------------------------------------------------------------

export async function updateSettings(patch: Partial<Settings>) {
  const saved = await api<Partial<Settings>>('/settings', { method: 'PUT', json: patch })
  set({ settings: { ...DEFAULT_SETTINGS, ...saved } })
}
