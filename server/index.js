import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import * as db from './db.js'
import * as auth from './auth.js'
import { draftEmail } from './email.js'

const PORT = Number(process.env.PORT) || 3000
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const SETTINGS_FIELDS = ['ownerName', 'calendlyUrl']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '10mb' }))

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next)

// --- Sign-in -------------------------------------------------------------------

app.get(
  '/api/session',
  wrap(async (req, res) => {
    const user = await auth.sessionUser(req)
    res.json({ user, setupNeeded: !user && !(await auth.hasAnyUser()), adminEmail: auth.ADMIN_EMAIL })
  }),
)

app.post(
  '/api/login',
  wrap(async (req, res) => {
    if (auth.tooManyAttempts(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' })
    const result = await auth.login(req.body?.email ?? '', req.body?.password ?? '')
    if (!result) {
      auth.recordFailure(req.ip)
      return res.status(401).json({ error: 'Wrong email or password' })
    }
    auth.clearFailures(req.ip)
    res.cookie(auth.COOKIE, result.token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: result.maxAge })
    res.json({ user: result.user })
  }),
)

app.post(
  '/api/logout',
  wrap(async (req, res) => {
    await auth.logout(req)
    res.clearCookie(auth.COOKIE)
    res.json({ ok: true })
  }),
)

app.get('/api/health', async (_req, res) => {
  await db.pool.query('SELECT 1')
  res.json({ ok: true })
})

// Everything below requires a signed-in user.
app.use('/api', (req, res, next) => {
  auth
    .sessionUser(req)
    .then((user) => {
      if (!user) return res.status(401).json({ error: 'Not signed in' })
      req.user = user
      next()
    })
    .catch(next)
})

app.post(
  '/api/me/password',
  wrap(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {}
    if (!(await auth.checkPassword(req.user.id, currentPassword))) return res.status(400).json({ error: 'Current password is wrong' })
    const problem = auth.validatePassword(newPassword)
    if (problem) return res.status(400).json({ error: problem })
    await auth.updateUser(req.user.id, { password: newPassword }) // signs out every session, including this one
    const result = await auth.login(req.user.email, newPassword)
    res.cookie(auth.COOKIE, result.token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: result.maxAge })
    res.json({ ok: true })
  }),
)

// --- Admin: manage users ---------------------------------------------------------

const adminOnly = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only' }))

app.get('/api/users', adminOnly, wrap(async (_req, res) => res.json(await auth.listUsers())))

app.post(
  '/api/users',
  adminOnly,
  wrap(async (req, res) => {
    const { email, name, role = 'member', password } = req.body ?? {}
    if (!EMAIL_RE.test(String(email ?? '').trim())) return res.status(400).json({ error: 'Enter a valid email address' })
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' })
    const problem = auth.validatePassword(password)
    if (problem) return res.status(400).json({ error: problem })
    try {
      res.status(201).json(await auth.createUser({ email, name, role, password }))
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'A user with that email already exists' })
      throw e
    }
  }),
)

app.patch(
  '/api/users/:id',
  adminOnly,
  wrap(async (req, res) => {
    const { name, role, password } = req.body ?? {}
    const target = await auth.getUser(req.params.id)
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (role !== undefined && !['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' })
    if (role === 'member' && target.role === 'admin' && (await auth.countAdmins()) <= 1)
      return res.status(400).json({ error: 'There must be at least one admin' })
    if (password !== undefined) {
      const problem = auth.validatePassword(password)
      if (problem) return res.status(400).json({ error: problem })
    }
    res.json(await auth.updateUser(req.params.id, { name, role, password }))
  }),
)

app.delete(
  '/api/users/:id',
  adminOnly,
  wrap(async (req, res) => {
    if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't remove your own account" })
    ;(await auth.deleteUser(req.params.id)) ? res.status(204).end() : res.status(404).json({ error: 'User not found' })
  }),
)

// --- Leads -------------------------------------------------------------------

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
await auth.migrateAuth()
await auth.ensureAdmin()
app.listen(PORT, () => console.log(`LeadFlow listening on :${PORT}`))
