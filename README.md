# LeadFlow — Sales CRM

A simple lead-tracking dashboard: home overview, drag-and-drop pipeline, searchable leads table, per-lead detail page (conversation history, notes, meeting, follow-up email draft), and CSV import.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ — deploy anywhere (Netlify, Vercel, Railway, S3…)
```

## Notes

- **Data is stored in the browser** (localStorage). Use *Settings → Export backup* to save a JSON copy or move leads to another computer.
- **CSV import** detects columns for name (or first + last name), company, job title, email and LinkedIn, in any order. Rows that match an existing lead's email or LinkedIn URL are skipped.
- **Follow-up email drafts** use a template by default. Add a Claude API key in *Settings* to get AI-written drafts based on the lead's conversation history and notes.
- The **Calendly link** (set in *Settings*) shows on each lead's meeting card and in email drafts, not on the home page.
