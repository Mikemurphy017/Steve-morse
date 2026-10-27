# LeadFlow — Sales CRM

A simple lead-tracking dashboard: home overview, drag-and-drop pipeline, searchable leads table, per-lead detail page (conversation history, notes, meeting, follow-up email draft), and CSV import. All prospect data is stored in Postgres.

## Deploying on Railway

The app is one Node service (`npm run build`, then `npm start`) that serves the frontend and a JSON API at `/api`. On first start it creates its tables (`leads`, `settings`).

Set these variables on the app service:

| Variable | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | yes | `${{Postgres.DATABASE_URL}}` (reference to the Postgres service) |
| `APP_PASSWORD` | strongly recommended | Shared password for signing in. Without it, anyone with the URL can see your leads. |
| `ANTHROPIC_API_KEY` | optional | Turns on AI-written follow-up emails. Without it, drafts use a template. |

## Local development

```bash
npm install
DATABASE_URL=postgres://… npm run server   # API on :3000
npm run dev                                # frontend on :5173, proxies /api to :3000
```

## Notes

- **CSV import** detects columns for name (or first + last name), company, job title, email and LinkedIn, in any order. Rows that match an existing lead's email or LinkedIn URL are skipped.
- **Backups:** *Settings → Export backup* downloads all leads as JSON; *Restore backup* replaces them.
- Leads saved in a browser by the earlier browser-only version are uploaded to the database automatically the first time that browser opens the app.
