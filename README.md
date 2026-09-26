# XE3AGLE v20.1 — DISCIPLINE OVER IMPULSE

A free-first trading discipline and journal application. This release focuses on functionality, data integrity, account safety, and maintainable foundations while retaining the v20 interface and brand assets.

## Free-first policy

The project is designed to run on free/open-source software and available free tiers. No paid subscription or billing system is included. Free tiers have provider limits and can change; production availability, custom domains, email delivery, storage, and always-on hosting depend on the provider's current terms. Never commit secrets or credentials.

## Architecture

- Frontend: static HTML/CSS/ES modules, deployable to a static host.
- API: Express, PostgreSQL (`pg`), JWT, bcryptjs, Helmet, rate limiting.
- Database: PostgreSQL compatible (Neon free tier or local PostgreSQL).
- Static frontend and API can be hosted separately. Set `XE3AGLE_API_URL`/the API config to the deployed API URL.

## Local setup

1. Install Node.js 20 or newer and PostgreSQL.
2. Copy `backend/.env.example` to `backend/.env` and set a strong random `JWT_SECRET`, `DATABASE_URL`, and allowed frontend origin. Do not commit `.env`.
3. Create a PostgreSQL database and apply `backend/sql/schema.sql`.
4. From `backend/`, run `npm install` then `npm start`.
5. Serve the project root with any static HTTP server (do not open `index.html` as a `file://` URL). Configure the frontend API URL.
6. Run checks from the project root: `npm test` and `npm run check`. Run backend syntax check from `backend/`.

## Important provider setup

Google OAuth, password-reset email, cloud media object storage, and live remote session revocation require provider credentials and configuration. The app must show an explicit setup/error state when a provider is not configured; never show success for a simulated operation. Use only free tiers/providers and verify their limits before production use.

## Security and data safety

- Keep API secrets exclusively in backend environment variables.
- Use HTTPS in deployed environments.
- Back up PostgreSQL and test restoration, not just backup creation.
- Restrict media objects to authenticated owners; do not make trade screenshots public by default.
- Offline edits should remain queued until a payload-aware sync handler confirms acceptance. Never discard queued changes on a failed sync.
- Do not treat frontend-only route guards as authorization; enforce ownership on every API request.

## Release status

v20.1 is a development build. Automated unit tests and syntax checks are not a substitute for a live OAuth, email, database, storage, cross-device, and browser/device acceptance test. See `V20.1-CHANGELOG.md` and `V20.1-RELEASE-CHECKLIST.md`.
