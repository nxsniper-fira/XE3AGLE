# XE3AGLE

Discipline Over Impulse.

## Stack
- Next.js 15 + React 19
- Auth.js v5
- Neon PostgreSQL + Drizzle
- Tailwind CSS
- Vitest

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Production notes
- App routes protect authenticated and admin content.
- Risk enforcement lives on the server.
- Transparent brand logo is stored in `public/logo.svg`.
