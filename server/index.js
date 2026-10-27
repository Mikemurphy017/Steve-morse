import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import * as db from './db.js'
import { draftEmail } from './email.js'

const PORT = Number(process.env.PORT) || 3000
const APP_PASSWORD = process.env.APP_PASSWORD || ''
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const COOKIE = 'leadflow_session'
const SETTINGS_FIELDS = ['ownerName', 'calendlyUrl']

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '10mb' }))

// --- Auth: optional single shared password (set APP_PASSWORD) ---------------

const sessionToken = () => crypto.createHmac('sha256', APP_PASSWORD).update('leadflow-session').digest('hex')

function hasSession(req) {
  if (!APP_PASSWORD) return true
  const cookie = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))
  const value = cookie?.slice(COOKIE.length + 1) ?? ''
  const expected = sessionToken()
  return value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected))
}

app.get('/api/session', (req, res) => {
  res.json({ authenticated: hasSession(req), passwordRequired: Boolean(APP_PASSWORD) })
})

app.post('/api/login', (req, res) => {
  const given = String(req.body?.password ?? '')
  const ok =
    APP_PASSWORD &&
    given.length === APP_PASSWORD.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(APP_PASSWORD))
  if (!ok) return res.status(401).json({ error: 'Wrong password' })
  res.cookie(COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: 1000 * 60 * 60 * 24 * 90,
  })
  res.json({ ok: true })
})

app.post('/api/logout', (_req, res) => {
  res.clearCookie(COOKIE)
  res.json({ ok: true })
})

app.get('/api/health', async (_req, res) => {
  await db.pool.query('SELECT 1')
  res.json({ ok: true })
})

app.use('/api', (req, res, next) => (hasSession(req) ? next() : res.status(401).json({ error: 'Not signed in' })))

// --- Leads -------------------------------------------------------------------

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next)

app.get('/api/leads', wrap(async (_req, res) => res.json(await db.listLeads())))

app.post(
  '/api/leads',
  wrap(async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body]
    if (items.some((l) => !l?.id || !l?.name)) return res.status(400).json({ error: 'Each lead needs an id and name' })
    res.status(201).json(await db.insertLeads(items))
  }),
)

// Replace every lead (used by "Restore backup").
app.put(
  '/api/leads',
  wrap(async (req, res) => {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected an array of leads' })
    res.json(await db.insertLeads(req.body, { replace: true }))
  }),
)

app.patch(
  '/api/leads/:id',
  wrap(async (req, res) => {
    const lead = await db.updateLead(req.params.id, req.body ?? {})
    lead ? res.json(lead) : res.status(404).json({ error: 'Lead not found' })
  }),
)

app.delete(
  '/api/leads/:id',
  wrap(async (req, res) => {
    ;(await db.deleteLead(req.params.id)) ? res.status(204).end() : res.status(404).json({ error: 'Lead not found' })
  }),
)

app.post(
  '/api/leads/:id/draft-email',
  wrap(async (req, res) => {
    const lead = await db.getLead(req.params.id)
    if (!lead) return res.status(404).json({ error: 'Lead not found' })
    res.json(await draftEmail(lead, await db.getSettings()))
  }),
)

// --- Settings ----------------------------------------------------------------

app.get(
  '/api/settings',
  wrap(async (_req, res) => {
    res.json({ ...(await db.getSettings()), aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY) })
  }),
)

app.put(
  '/api/settings',
  wrap(async (req, res) => {
    const patch = Object.fromEntries(SETTINGS_FIELDS.filter((k) => k in req.body).map((k) => [k, String(req.body[k])]))
    res.json({ ...(await db.saveSettings(patch)), aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY) })
  }),
)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Server error' })
})

// --- Frontend ----------------------------------------------------------------

app.use(express.static(DIST, { index: false }))
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))

await db.migrate()
app.listen(PORT, () => console.log(`LeadFlow listening on :${PORT}${APP_PASSWORD ? ' (password protected)' : ''}`))
