// Builds follow-up email drafts. Uses Claude when ANTHROPIC_API_KEY is set, otherwise a template.

function firstName(name) {
  return name.trim().split(/\s+/)[0] || 'there'
}

function leadContext(lead) {
  const history = [...lead.messages]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => `[${m.date}] ${m.direction === 'sent' ? 'Sent by us' : 'Received from lead'}:\n${m.text}`)
    .join('\n\n')
  const notes = lead.notes.map((n) => `- ${n.text}`).join('\n')
  return [
    `Lead: ${lead.name}${lead.title ? `, ${lead.title}` : ''}${lead.company ? ` at ${lead.company}` : ''}`,
    lead.summary && `Conversation summary: ${lead.summary}`,
    lead.nextAction && `Next action needed: ${lead.nextAction}`,
    lead.lastContact && `Last contact: ${lead.lastContact}`,
    history && `Conversation history:\n${history}`,
    notes && `Notes:\n${notes}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function templateDraft(lead, settings) {
  const owner = settings.ownerName || 'Steve'
  return [
    `Subject: ${lead.company ? `Following up — ${lead.company}` : 'Following up'}`,
    '',
    `Hi ${firstName(lead.name)},`,
    '',
    lead.summary
      ? `I wanted to follow up on our recent conversation. ${lead.summary.replace(/\.?$/, '.')}`
      : 'I wanted to follow up on our recent conversation on LinkedIn.',
    '',
    settings.calendlyUrl
      ? `If it's still helpful to connect, you can grab a time that works for you here: ${settings.calendlyUrl}`
      : 'Would you have 20 minutes for a quick call in the next week or two?',
    '',
    'Looking forward to speaking.',
    '',
    'Best,',
    owner,
  ].join('\n')
}

export async function draftEmail(lead, settings) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { draft: templateDraft(lead, settings), source: 'template' }

  const owner = settings.ownerName || 'Steve'
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 1024,
        system:
          `You write short, warm, professional follow-up emails on behalf of ${owner}. ` +
          'Base the email only on the provided context. Keep it under 150 words, no fluff, one clear call to action. ' +
          (settings.calendlyUrl ? `When proposing a call, include this booking link: ${settings.calendlyUrl}. ` : '') +
          'Output the email only, starting with a "Subject:" line.',
        messages: [{ role: 'user', content: leadContext(lead) }],
      }),
    })
    if (!res.ok) throw new Error(`Claude API error ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = await res.json()
    const text = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim()
    return { draft: text, source: 'ai' }
  } catch (e) {
    console.error(e)
    return { draft: templateDraft(lead, settings), source: 'template', error: 'AI draft failed — showing a template instead.' }
  }
}
