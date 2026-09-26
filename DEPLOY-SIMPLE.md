# XE3AGLE — Deploy like you’re 12 (step by step)

You need **4 free accounts**. That’s it.

1. **GitHub** — stores your code  
2. **Neon** — the database (a box that remembers users + trades + screenshots)  
3. **Render** — runs the “brain” (login API)  
4. **Vercel** — shows the website  

---

## Step 0 — Unzip the project

1. Download `XE3AGLE-v20.zip`
2. Unzip it
3. You should see a folder named **`XE3AGLE-v20`**

Keep that folder open. You’ll need files from it.

---

## Step 1 — Put the code on GitHub

1. Go to **https://github.com** and sign up / log in  
2. Click the green **New** button (new repository)  
3. Name it: `xe3agle`  
4. Choose **Private**  
5. Click **Create repository**

### Upload the files

**Easy way (website):**

1. On the empty repo page, click **uploading an existing file**  
2. Drag **everything inside** the `XE3AGLE-v20` folder onto the page  
   (not the outer zip — the files: `index.html`, `backend`, `js`, etc.)  
3. Click **Commit changes**

**Or use Terminal** (if you know git):

```bash
cd XE3AGLE-v20
git init
git add .
git commit -m "XE3AGLE v20"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/xe3agle.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub name.

---

## Step 2 — Make the database (Neon)

1. Go to **https://neon.tech** → sign up (free)  
2. Click **Create Project**  
3. Name it `xe3agle` → Create  
4. Find **Connection string** — it starts with `postgresql://`  
5. **Copy it** and paste it into Notepad for later  

### Create the tables

1. In Neon, open **SQL Editor**  
2. Open the file from your project:  
   `backend/sql/schema.sql`  
3. Copy **all** of that file  
4. Paste into Neon SQL Editor  
5. Click **Run**  

If it says success / done — good. Database is ready.

---

## Step 3 — Start the brain (Render)

1. Go to **https://render.com** → sign up  
2. Connect **GitHub** when asked  
3. Click **New +** → **Web Service**  
4. Pick your **`xe3agle`** repo  

### Settings (type these carefully)

| Setting | What to put |
|--------|-------------|
| **Name** | `xe3agle-api` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

### Environment variables (secret settings)

Click **Environment** and add:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | the long `postgresql://...` string from Neon |
| `JWT_SECRET` | make up a long random password (like 30+ random letters/numbers) |
| `FRONTEND_ORIGIN` | leave as `https://placeholder.vercel.app` for now (you’ll fix after Step 5) |
| `APP_URL` | same as `FRONTEND_ORIGIN` for now |

Optional (Google login later):

| Key | Value |
|-----|--------|
| `GOOGLE_CLIENT_ID` | from Google Cloud (only if you want Google sign-in) |

Optional (password reset emails):

| Key | Value |
|-----|--------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail |
| `SMTP_PASS` | Gmail **App Password** (not your normal password) |

5. Click **Create Web Service** / **Deploy**  
6. Wait until it says **Live**  
7. Copy your Render URL — looks like:  
   `https://xe3agle-api-xxxx.onrender.com`

### Test the brain

Open this in your browser (use **your** URL):

```text
https://YOUR-RENDER-URL.onrender.com/api/health
```

You should see something like:

```json
{"ok":true,"service":"xe3agle-api","version":"20.0.0",...}
```

If you see that → backend works. ✅

---

## Step 4 — Tell the website where the brain is

1. On your computer, open the file: **`api-config.js`**  
2. Change it to your Render URL:

```js
window.XE3AGLE_CONFIG = {
  API_BASE: 'https://YOUR-RENDER-URL.onrender.com',
};
```

3. Save the file  
4. Upload/push this change to GitHub again (same as Step 1)

---

## Step 5 — Put the website online (Vercel)

1. Go to **https://vercel.com** → sign up  
2. Connect **GitHub**  
3. Click **Add New Project**  
4. Choose the **`xe3agle`** repo  
5. Settings:
   - Framework: **Other**
   - Leave build settings empty  
6. Click **Deploy**  
7. Wait ~1 minute  
8. Copy your site URL — like `https://xe3agle.vercel.app`

### Go back to Render (important!)

1. Open your Render service → **Environment**  
2. Change:

| Key | New value |
|-----|-----------|
| `FRONTEND_ORIGIN` | `https://your-real-site.vercel.app` |
| `APP_URL` | `https://your-real-site.vercel.app` |

3. Save → Render will restart  

---

## Step 6 — Try it

1. Open your **Vercel** URL  
2. You should see the **landing page** (logo, features, Sign in / Sign up)  
3. Click **Sign up free**  
4. Make an account  
5. You should land in the **dashboard**  

### Check these work

- Log out → log in again (it should remember you next time)  
- Add a trade with a screenshot (needs login + working API)  
- Open the site on your phone  

---

## Google login (optional)

Only if you want the orange **Continue with Google** button to work:

1. Go to **https://console.cloud.google.com**  
2. Create a project  
3. **APIs & Services** → **Credentials** → **Create OAuth client ID** → type **Web application**  
4. Under **Authorized JavaScript origins** add:
   - `https://your-site.vercel.app`  
5. Copy the **Client ID**  
6. On Render, set `GOOGLE_CLIENT_ID` = that Client ID  
7. Redeploy / restart Render  

---

## If something breaks

| Problem | What to do |
|--------|------------|
| “Authentication failed” | Wrong `api-config.js` URL, or Render is asleep (free plan sleeps — wait 30–60 sec and try again) |
| Health URL doesn’t open | Render not deployed, or Root Directory is not `backend` |
| Login works but sync fails | Bad `DATABASE_URL` — copy again from Neon |
| Screenshot won’t upload | Must be logged in; re-run `schema.sql` so the `media` table exists |
| Page looks old | Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac) |
| Dashboard without login | You still have a saved session — click **Log out** |

---

## What each page is

| URL | Meaning |
|-----|--------|
| `/` or `index.html` | Landing (public) |
| `login.html` | Sign in / Sign up |
| `app.html` | Dashboard (private — needs login) |

---

## You’re done when…

1. Health URL returns `"ok": true`  
2. You can sign up  
3. You can open the dashboard  
4. After closing the browser and coming back, you’re still logged in  

That’s the whole game. 🎯
