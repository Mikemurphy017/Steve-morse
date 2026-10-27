import Papa from 'papaparse'

export type Field = 'name' | 'firstName' | 'lastName' | 'company' | 'title' | 'email' | 'linkedin'

const ALIASES: Record<Field, string[]> = {
  name: ['name', 'full name', 'fullname', 'contact', 'contact name', 'lead name'],
  firstName: ['first name', 'firstname', 'first', 'given name'],
  lastName: ['last name', 'lastname', 'last', 'surname', 'family name'],
  company: ['company', 'company name', 'organization', 'organisation', 'account', 'firm', 'employer'],
  title: ['title', 'job title', 'position', 'role', 'headline', 'job'],
  email: ['email', 'email address', 'e-mail', 'work email', 'mail'],
  linkedin: ['linkedin', 'linkedin url', 'linkedin profile', 'profile url', 'profile', 'linkedin link', 'url'],
}

function normalize(h: string) {
  return h.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export interface ParsedRow {
  name: string
  company: string
  title: string
  email: string
  linkedin: string
}

export interface ParseResult {
  headers: string[]
  mapping: Partial<Record<Field, string>>
  rows: ParsedRow[]
}

export function detectMapping(headers: string[]): Partial<Record<Field, string>> {
  const mapping: Partial<Record<Field, string>> = {}
  const used = new Set<string>()
  // Exact alias matches first, then substring matches.
  for (const pass of ['exact', 'contains'] as const) {
    for (const field of Object.keys(ALIASES) as Field[]) {
      if (mapping[field]) continue
      const hit = headers.find((h) => {
        if (used.has(h)) return false
        const n = normalize(h)
        return pass === 'exact' ? ALIASES[field].includes(n) : ALIASES[field].some((a) => a.length > 3 && n.includes(a))
      })
      if (hit) {
        mapping[field] = hit
        used.add(hit)
      }
    }
  }
  return mapping
}

export function parseCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (res) => {
        const headers = res.meta.fields ?? []
        const mapping = detectMapping(headers)
        const get = (r: Record<string, string>, f: Field) => (mapping[f] ? (r[mapping[f]!] ?? '').trim() : '')
        const rows = res.data
          .map((r) => {
            const full = get(r, 'name') || [get(r, 'firstName'), get(r, 'lastName')].filter(Boolean).join(' ')
            return {
              name: full,
              company: get(r, 'company'),
              title: get(r, 'title'),
              email: get(r, 'email'),
              linkedin: get(r, 'linkedin'),
            }
          })
          .filter((r) => r.name || r.email || r.linkedin)
        resolve({ headers, mapping, rows })
      },
      error: reject,
    })
  })
}
