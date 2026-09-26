# XE3AGLE v20 — Full Setup Guide (Login Works After These Steps)

---

## What You Need (All Free)

| Service | What it does | Link |
|---|---|---|
| GitHub | Stores your code | github.com |
| Neon | Your database | neon.tech |
| Render | Runs your backend | render.com |
| Vercel | Hosts your website | vercel.com |

---

## Step 1 — Push to GitHub

1. Go to **github.com** → **New** repository
2. Name it `xe3agle` → keep it **Private** → Create
3. On your computer, open Terminal inside the unzipped `XE3AGLE-v20` folder and run:

```bash
git init
git add .
git commit -m "XE3AGLE v20"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/xe3agle.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

---

## Step 2 — Set Up Neon Database

1. Go to **neon.tech** → Sign up (free)
2. **Create Project** → name it `xe3agle`
3. Copy the connection string that starts with `postgresql://` (Connection Details)
4. In the Neon SQL Editor, paste and run the contents of `backend/sql/schema.sql`

---

## Step 3 — Deploy Backend on Render

1. Go to **render.com** → Sign up → connect GitHub
2. **New** → **Web Service** → select your `xe3agle` repo
3. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Environment variables:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` | Long random string (32+ chars) |
| `FRONTEND_ORIGIN` | Your Vercel URL (can update after Step 5) |
| `APP_URL` | Same as FRONTEND_ORIGIN |

Optional email (password reset):

| Key | Value |
|-----|--------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail |
| `SMTP_PASS` | Gmail App Password |
| `FROM_EMAIL` | e.g. `noreply@xe3agle.app` |

5. Deploy → copy the service URL (e.g. `https://xe3agle-api.onrender.com`)

Health check: `https://YOUR-RENDER-URL.onrender.com/api/health`  
Should return: `{"ok":true,"service":"xe3agle-api","version":"20.0.0",...}`

---

## Step 4 — Point Frontend at the API

Edit `api-config.js`:

```js
window.XE3AGLE_CONFIG = { API_BASE: 'https://YOUR-XE3AGLE-API.onrender.com' };
```

Commit and push:

```bash
git add api-config.js
git commit -m "Set API URL"
git push
```

---

## Step 5 — Deploy Frontend on Vercel

1. **vercel.com** → Sign up → connect GitHub
2. **Add New Project** → select `xe3agle`
3. Framework Preset: **Other** — leave build/output blank
4. Deploy

---

## Step 6 — Test

1. Open the Vercel URL
2. Sign up → you should land on the dashboard
3. Log out / log in to confirm JWT session works

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Authentication failed | Wrong `api-config.js` URL or Render down — check Render logs |
| Dashboard without login | Existing local session — use Log out |
| Cloud sync unavailable | Bad `DATABASE_URL` on Render |
| Build failed on Render | Root Directory must be `backend` |
| Offline assets missing | Hard-refresh once after deploy so SW updates to `xe3agle-v20` |

---


---

## Google Sign-In (optional but recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Credentials**
2. **Create Credentials** → **OAuth client ID** → Application type **Web application**
3. Name it `XE3AGLE`
4. **Authorized JavaScript origins** — add:
   - `https://YOUR-APP.vercel.app`
   - `http://localhost` (optional, for local testing)
5. Copy the **Client ID** (ends with `.apps.googleusercontent.com`)
6. On **Render** → your API service → Environment → add:

| Key | Value |
|-----|--------|
| `GOOGLE_CLIENT_ID` | the Client ID from step 5 |

7. (Optional) In `api-config.js` you can also set `GOOGLE_CLIENT_ID` to the same value — otherwise the frontend loads it from `GET /api/config`.
8. Redeploy Render, hard-refresh the site, click **Continue with Google**.

If Google is not configured, email/password still works and the Google button shows a clear error.

## Notes for v20

- Sessions last **14 days** (re-login after expiry).
- Trade screenshots stay **in the browser only** — no cloud media endpoint yet.
- Free Render services spin down when idle; first request after idle may take ~30s.
