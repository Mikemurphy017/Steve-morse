import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { pool } from './db.js'

const scrypt = promisify(crypto.scrypt)
const SESSION_DAYS = 90
export const COOKIE = 'leadflow_session'
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'mike@bluestonepartnersllc.com').toLowerCase()

export async function migrateAuth() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             UUID PRIMARY KEY,
      email          TEXT NOT NULL UNIQUE,
      name           TEXT NOT NULL DEFAULT '',
      role           TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
      password_hash  TEXT NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at  TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      expires_at  TIMESTAMPTZ NOT NULL
    );
  `)
  await pool.query('DELETE FROM sessions WHERE expires_at < now()')
}

// Creates the first admin account (Mike) from ADMIN_PASSWORD, or APP_PASSWORD as a fallback.
export async function ensureAdmin() {
  const password = process.env.ADMIN_PASSWORD || process.env.APP_PASSWORD
  const { rows } = await pool.query('SELECT 1 FROM users WHERE email = $1', [ADMIN_EMAIL])
  if (rows.length) return
  if (!password) {
    console.warn(`No admin account yet. Set ADMIN_PASSWORD to create ${ADMIN_EMAIL}.`)
    return
  }
  await createUser({ email: ADMIN_EMAIL, name: 'Mike Murphy', role: 'admin', password })
  console.log(`Created admin account ${ADMIN_EMAIL}`)
}

export async function hasAnyUser() {
  const { rows } = await pool.query('SELECT 1 FROM users LIMIT 1')
  return rows.length > 0
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

async function verifyPassword(password, stored) {
  const [, saltHex, keyHex] = stored.split('$')
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64)
  return crypto.timingSafeEqual(key, Buffer.from(keyHex, 'hex'))
}

const publicUser = (r) => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  createdAt: r.created_at.toISOString(),
  lastLoginAt: r.last_login_at ? r.last_login_at.toISOString() : null,
})

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export async function listUsers() {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at')
  return rows.map(publicUser)
}

export async function createUser({ email, name, role, password }) {
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, name, role, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [crypto.randomUUID(), email.trim().toLowerCase(), (name || '').trim(), role, await hashPassword(password)],
  )
  return publicUser(rows[0])
}

export async function updateUser(id, { name, role, password }) {
  const sets = []
  const vals = [id]
  if (name !== undefined) sets.push(`name = $${vals.push(String(name).trim())}`)
  if (role !== undefined) sets.push(`role = $${vals.push(role)}`)
  if (password !== undefined) sets.push(`password_hash = $${vals.push(await hashPassword(password))}`)
  if (!sets.length) return null
  const { rows } = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, vals)
  if (rows[0] && password !== undefined) await pool.query('DELETE FROM sessions WHERE user_id = $1', [id])
  return rows[0] ? publicUser(rows[0]) : null
}

export async function deleteUser(id) {
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id])
  return rowCount > 0
}

export async function countAdmins() {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`)
  return rows[0].n
}

export async function getUser(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id])
  return rows[0] ? publicUser(rows[0]) : null
}

// --- Sessions ------------------------------------------------------------------

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex')

export async function login(email, password) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()])
  const user = rows[0]
  if (!user || !(await verifyPassword(String(password), user.password_hash))) return null
  const token = crypto.randomBytes(32).toString('hex')
  await pool.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [
    hashToken(token),
    user.id,
  ])
  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id])
  return { token, user: publicUser(user), maxAge: SESSION_DAYS * 86_400_000 }
}

function readToken(req) {
  const c = (req.headers.cookie || '').split(/;\s*/).find((x) => x.startsWith(`${COOKIE}=`))
  return c ? c.slice(COOKIE.length + 1) : ''
}

export async function sessionUser(req) {
  const token = readToken(req)
  if (!token) return null
  const { rows } = await pool.query(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  )
  return rows[0] ? publicUser(rows[0]) : null
}

export async function logout(req) {
  const token = readToken(req)
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
}

export async function checkPassword(userId, password) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId])
  return rows[0] ? verifyPassword(String(password), rows[0].password_hash) : false
}

// Simple in-memory limit on failed sign-ins: 10 per IP per 15 minutes.
const failures = new Map()
export function tooManyAttempts(ip) {
  const f = failures.get(ip)
  return Boolean(f && f.count >= 10 && Date.now() - f.since < 15 * 60_000)
}
export function recordFailure(ip) {
  const f = failures.get(ip)
  if (!f || Date.now() - f.since >= 15 * 60_000) failures.set(ip, { count: 1, since: Date.now() })
  else f.count++
}
export function clearFailures(ip) {
  failures.delete(ip)
}
