import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, CloudUpload, FileText } from 'lucide-react'
import { addLeads, newLead, useLeads } from '../lib/store'
import type { StageId } from '../lib/types'
import { STAGES } from '../lib/types'
import type { ParseResult } from '../lib/csv'
import { parseCsv } from '../lib/csv'

const FIELD_LABELS: [string, string][] = [
  ['name', 'Name'],
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['company', 'Company'],
  ['title', 'Job title'],
  ['email', 'Email'],
  ['linkedin', 'LinkedIn'],
]

export default function UploadPage() {
  const existing = useLeads()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [stage, setStage] = useState<StageId>('new')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<{ added: number; skipped: number } | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setImported(null)
    try {
      const r = await parseCsv(file)
      if (r.rows.length === 0) throw new Error('No rows with a name, email, or LinkedIn URL were found.')
      setFileName(file.name)
      setResult(r)
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  const keyOf = (r: { name: string; email: string; linkedin: string }) =>
    (r.email || r.linkedin.replace(/\/+$/, '') || r.name).toLowerCase()

  const doImport = async () => {
    if (!result) return
    const seen = new Set(existing.map(keyOf))
    const fresh = result.rows.filter((r) => {
      const k = keyOf(r)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    setImporting(true)
    try {
      await addLeads(fresh.map((r) => newLead({ ...r, name: r.name || r.email || 'Unknown', stage })))
      setImported({ added: fresh.length, skipped: result.rows.length - fresh.length })
      setResult(null)
    } catch (e) {
      setError(`Import failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight">Upload leads</h1>
      <p className="mt-1 text-slate-500">
        Import a CSV spreadsheet. We'll detect columns for name, company, job title, email, and LinkedIn.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files[0])
        }}
        className={`mt-8 flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-14 transition ${
          dragging ? 'border-slate-400 bg-slate-100' : 'border-slate-300 bg-white hover:bg-slate-50'
        }`}
      >
        <CloudUpload className="h-10 w-10 text-slate-400" />
        <span className="mt-3 font-semibold text-slate-800">Click to choose a CSV file</span>
        <span className="text-sm text-slate-400">or drag and drop</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {imported && (
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-emerald-50 px-5 py-4 text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          <span>
            Imported {imported.added} lead{imported.added === 1 ? '' : 's'}
            {imported.skipped > 0 && ` · skipped ${imported.skipped} duplicate${imported.skipped === 1 ? '' : 's'}`}.{' '}
            <Link to="/leads" className="font-semibold underline">
              View leads
            </Link>
          </span>
        </div>
      )}

      {result && (
        <div className="card mt-6 p-6">
          <div className="flex items-center gap-2 font-semibold">
            <FileText className="h-5 w-5 text-slate-400" /> {fileName} · {result.rows.length} rows
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {FIELD_LABELS.filter(([f]) => result.mapping[f as keyof ParseResult['mapping']] || ['name', 'company', 'title', 'email', 'linkedin'].includes(f)).map(([f, label]) => {
              const col = result.mapping[f as keyof ParseResult['mapping']]
              return (
                <div key={f} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">{label}</div>
                  <div className={col ? 'font-medium' : 'italic text-slate-400'}>{col ?? 'not found'}</div>
                </div>
              )
            })}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  {['Name', 'Company', 'Title', 'Email', 'LinkedIn'].map((h) => (
                    <th key={h} className="py-2 pr-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4">{r.name}</td>
                    <td className="py-2 pr-4">{r.company}</td>
                    <td className="py-2 pr-4">{r.title}</td>
                    <td className="py-2 pr-4">{r.email}</td>
                    <td className="max-w-[180px] truncate py-2 pr-4">{r.linkedin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length > 5 && <p className="mt-2 text-sm text-slate-400">…and {result.rows.length - 5} more</p>}
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Start imported leads in</label>
              <select className="input w-60" value={stage} onChange={(e) => setStage(e.target.value as StageId)}>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={doImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${result.rows.length} leads`}
            </button>
            <button className="btn-secondary" onClick={() => setResult(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-xl bg-slate-100/70 px-5 py-4 text-sm">
        <div className="font-semibold text-slate-700">Expected columns (any order):</div>
        <div className="mt-1 text-slate-500">name (or first name + last name), company, job title, email, linkedin</div>
        <div className="mt-1 text-slate-400">Rows that match an existing lead's email or LinkedIn URL are skipped.</div>
      </div>
    </div>
  )
}
