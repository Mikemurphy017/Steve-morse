import { useSyncExternalStore } from 'react'
import type { Lead, Settings } from './types'

const LEADS_KEY = 'leadflow.leads.v1'
const SETTINGS_KEY = 'leadflow.settings.v1'

const DEFAULT_SETTINGS: Settings = {
  ownerName: 'Steve',
  calendlyUrl: 'https://calendly.com/steve-morse-seatonhill',
  anthropicApiKey: '',
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

let leads: Lead[] = load<Lead[]>(LEADS_KEY, [])
let settings: Settings = { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(SETTINGS_KEY, {}) }
const listeners = new Set<() => void>()

function emit() {
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads))
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Keep tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key === LEADS_KEY || e.key === SETTINGS_KEY) {
    leads = load<Lead[]>(LEADS_KEY, [])
    settings = { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(SETTINGS_KEY, {}) }
    listeners.forEach((l) => l())
  }
})

export function useLeads(): Lead[] {
  return useSyncExternalStore(subscribe, () => leads)
}

export function useLead(id: string | undefined): Lead | undefined {
  const all = useLeads()
  return all.find((l) => l.id === id)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settings)
}

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

export function addLeads(items: Lead[]) {
  leads = [...items, ...leads]
  emit()
}

export function updateLead(id: string, patch: Partial<Lead>) {
  leads = leads.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l))
  emit()
}

export function deleteLead(id: string) {
  leads = leads.filter((l) => l.id !== id)
  emit()
}

export function replaceAllLeads(items: Lead[]) {
  leads = items
  emit()
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  emit()
}

