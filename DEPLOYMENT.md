# XE3AGLE v20 — Deployment

## Architecture
- **Vercel**: static frontend / PWA
- **Render**: Express API (auth + state sync)
- **Neon**: PostgreSQL

## Quick path
1. Push this repo to GitHub.
2. Create Neon project → run `backend/sql/schema.sql`.
3. Create Render Web Service with Root Directory `backend`. Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, `APP_URL`.
4. Set `api-config.js` → Render URL → push.
5. Deploy repo on Vercel (framework: Other).

Full step-by-step: see `SETUP.md`.

## Health
`GET /api/health` → `{"ok":true,"service":"xe3agle-api","version":"20.0.0",...}`

## Notes
- JWT sessions: 14 days.
- Screenshots: local browser only (no cloud media endpoint).
- Optional SMTP enables password-reset email.
