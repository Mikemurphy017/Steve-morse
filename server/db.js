import pg from 'pg'

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Dates.
pg.types.setTypeParser(1082, (v) => v)

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. On Railway, add DATABASE_URL=${{Postgres.DATABASE_URL}} to this service.')
  process.exit(1)
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id              UUID PRIMARY KEY,
      name            TEXT NOT NULL,
      company         TEXT NOT NULL DEFAULT '',
      title           TEXT NOT NULL DEFAULT '',
      email           TEXT NOT NULL DEFAULT '',
      linkedin        TEXT NOT NULL DEFAULT '',
      stage           TEXT NOT NULL DEFAULT 'new',
      next_follow_up  DATE,
      last_contact    DATE,
      next_action     TEXT NOT NULL DEFAULT '',
      summary         TEXT NOT NULL DEFAULT '',
      messages        JSONB NOT NULL DEFAULT '[]',
      notes           JSONB NOT NULL DEFAULT '[]',
      meeting_date    DATE,
      meeting_time    TEXT NOT NULL DEFAULT '',
      meeting_booked  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads (stage);
    CREATE INDEX IF NOT EXISTS leads_next_follow_up_idx ON leads (next_follow_up);
    CREATE TABLE IF NOT EXISTS settings (
      id    INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data  JSONB NOT NULL DEFAULT '{}'
    );
  `)
}

// camelCase API field -> column. Dates use '' in the app and NULL in the DB.
const COLUMNS = {
  name: 'name',
  company: 'company',
  title: 'title',
  email: 'email',
  linkedin: 'linkedin',
  stage: 'stage',
  nextFollowUp: 'next_follow_up',
  lastContact: 'last_contact',
  nextAction: 'next_action',
  summary: 'summary',
  messages: 'messages',
  notes: 'notes',
  meetingDate: 'meeting_date',
  meetingTime: 'meeting_time',
  meetingBooked: 'meeting_booked',
}
const DATE_FIELDS = new Set(['nextFollowUp', 'lastContact', 'meetingDate'])
const JSON_FIELDS = new Set(['messages', 'notes'])

function toDb(field, value) {
  if (DATE_FIELDS.has(field)) return value || null
  if (JSON_FIELDS.has(field)) return JSON.stringify(Array.isArray(value) ? value : [])
  if (field === 'meetingBooked') return Boolean(value)
  return value == null ? '' : String(value)
}

export function rowToLead(r) {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    title: r.title,
    email: r.email,
    linkedin: r.linkedin,
    stage: r.stage,
    nextFollowUp: r.next_follow_up ?? '',
    lastContact: r.last_contact ?? '',
    nextAction: r.next_action,
    summary: r.summary,
    messages: r.messages,
    notes: r.notes,
    meetingDate: r.meeting_date ?? '',
    meetingTime: r.meeting_time,
    meetingBooked: r.meeting_booked,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }
}

export async function listLeads() {
  const { rows } = await pool.query('SELECT * FROM leads ORDER BY created_at DESC, name')
  return rows.map(rowToLead)
}

export async function getLead(id) {
  const { rows } = await pool.query('SELECT * FROM leads WHERE id = $1', [id])
  return rows[0] ? rowToLead(rows[0]) : null
}

async function insertLead(client, lead) {
  const fields = Object.keys(COLUMNS).filter((f) => f in lead)
  const cols = ['id', ...fields.map((f) => COLUMNS[f])]
  const vals = [lead.id, ...fields.map((f) => toDb(f, lead[f]))]
  if (lead.createdAt) {
    cols.push('created_at', 'updated_at')
    vals.push(lead.createdAt, lead.updatedAt || lead.createdAt)
  }
  const ph = vals.map((_, i) => `$${i + 1}`).join(', ')
  const { rows } = await client.query(
    `INSERT INTO leads (${cols.join(', ')}) VALUES (${ph}) ON CONFLICT (id) DO NOTHING RETURNING *`,
    vals,
  )
  return rows[0] ? rowToLead(rows[0]) : null
}

export async function insertLeads(leads, { replace = false } = {}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (replace) await client.query('DELETE FROM leads')
    const out = []
    for (const lead of leads) {
      const row = await insertLead(client, lead)
      if (row) out.push(row)
    }
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export async function updateLead(id, patch) {
  const fields = Object.keys(COLUMNS).filter((f) => f in patch)
  if (fields.length === 0) return getLead(id)
  const sets = fields.map((f, i) => `${COLUMNS[f]} = $${i + 2}`)
  const { rows } = await pool.query(
    `UPDATE leads SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...fields.map((f) => toDb(f, patch[f]))],
  )
  return rows[0] ? rowToLead(rows[0]) : null
}

export async function deleteLead(id) {
  const { rowCount } = await pool.query('DELETE FROM leads WHERE id = $1', [id])
  return rowCount > 0
}

export async function getSettings() {
  const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
  return rows[0]?.data ?? {}
}

export async function saveSettings(patch) {
  const { rows } = await pool.query(
    `INSERT INTO settings (id, data) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET data = settings.data || EXCLUDED.data
     RETURNING data`,
    [JSON.stringify(patch)],
  )
  return rows[0].data
}
