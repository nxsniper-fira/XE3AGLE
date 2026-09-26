import { api, apiBase } from './api-client.js';

let currentUser = null;
let listeners   = [];
let googleClientId = null;
let googleReady = null;

const dto = u => u ? {
  uid: u.id, id: u.id, email: u.email,
  username: u.username || '',
  displayName: u.displayName || u.username || 'XE3AGLE Trader',
  emailVerified: !!u.emailVerified,
} : null;

async function bootFromToken() {
  const token = localStorage.getItem('xe3agle_token');
  if (!token) return null;
  try {
    currentUser = dto((await api('/api/auth/me')).user);
    return currentUser;
  } catch (e) {
    // Only wipe session on hard auth failure — not on network / sleeping server
    const code = e?.code || e?.message || '';
    const status = e?.status;
    if (status === 401 || code === 'AUTH_REQUIRED' || code === 'USER_NOT_FOUND' || code === 'INVALID_TOKEN') {
      localStorage.removeItem('xe3agle_token');
      currentUser = null;
      return null;
    }
    // Network / timeout: keep token, treat as still signed in offline
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      currentUser = dto({
        id: payload.sub,
        email: payload.email || 'trader@local',
        displayName: payload.name || 'XE3AGLE Trader',
        emailVerified: true,
      });
      return currentUser;
    } catch {
      return currentUser; // last known
    }
  }
}

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-xe-google]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GOOGLE_SCRIPT_FAILED')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.dataset.xeGoogle = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('GOOGLE_SCRIPT_FAILED'));
    document.head.appendChild(s);
  });
}

async function ensureGoogleClientId() {
  if (googleClientId) return googleClientId;
  // Prefer explicit config, else fetch from API
  const fromConfig = window.XE3AGLE_CONFIG?.GOOGLE_CLIENT_ID;
  if (fromConfig) {
    googleClientId = fromConfig;
    return googleClientId;
  }
  const base = apiBase(); // '' = same-origin Vercel proxy
  try {
    const r = await fetch((base || '') + '/api/config');
    const data = await r.json();
    if (!data.googleClientId) throw new Error('GOOGLE_OAUTH_NOT_CONFIGURED');
    googleClientId = data.googleClientId;
    return googleClientId;
  } catch (e) {
    throw Object.assign(new Error(e.message || 'GOOGLE_OAUTH_NOT_CONFIGURED'), { code: 'GOOGLE_OAUTH_NOT_CONFIGURED' });
  }
}

function googlePrompt(clientId) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err, cred) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(cred);
    };
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) done(null, response.credential);
          else done(Object.assign(new Error('GOOGLE_CANCELLED'), { code: 'GOOGLE_CANCELLED' }));
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      // One Tap / prompt; also support button click path via renderButton fallback
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
          // Fall through — caller may use button render; for click handler we use oauth2 token client alternative
        }
      });
      // Use oauth2 code/token via popup style: gis has requestAccessToken for code flow;
      // For ID token on button click, use temporary renderButton or the credential from a custom button:
      // google.accounts.id.prompt is One Tap; for explicit button use:
      window.google.accounts.oauth2 // may not give id token
    } catch (e) {
      done(e);
    }
    // Explicit ID token via popup using the newer GIS approach:
    // Use `google.accounts.id.attachClickHandler` alternative — implement getCredential with temporary container
  });
}

/** Explicit Google sign-in: shows GIS One Tap or popup credential */
async function obtainGoogleIdToken(clientId) {
  await loadGoogleScript();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, token) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(token);
    };

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response?.credential) finish(null, response.credential);
        else finish(Object.assign(new Error('GOOGLE_CANCELLED'), { code: 'GOOGLE_CANCELLED' }));
      },
      auto_select: false,
      use_fedcm_for_prompt: true,
    });

    // Create a hidden GIS button and click it — most reliable for "Continue with Google"
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    document.body.appendChild(host);
    window.google.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: 320,
    });
    // Click the generated button
    setTimeout(() => {
      const btn = host.querySelector('div[role="button"]') || host.querySelector('iframe') || host.firstElementChild;
      if (btn) {
        try { btn.click(); } catch (_) {}
        // Also try dispatching on nested elements
        host.querySelectorAll('div').forEach((el) => {
          try { el.click(); } catch (_) {}
        });
      }
      // Fallback: One Tap prompt
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // User may still interact with rendered button if visible — show visible modal button
          showVisibleGoogleButton(clientId, finish, host);
        }
      });
    }, 50);

    // Safety timeout
    setTimeout(() => {
      if (!settled) {
        showVisibleGoogleButton(clientId, finish, host);
      }
    }, 400);
  });
}

function showVisibleGoogleButton(clientId, finish, oldHost) {
  try { oldHost?.remove(); } catch (_) {}
  if (document.getElementById('xe-google-btn-host')) return;
  const overlay = document.createElement('div');
  overlay.id = 'xe-google-btn-host';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(6px)';
  overlay.innerHTML = `
    <div style="background:#12141a;border:1px solid #2a2d38;border-radius:16px;padding:28px;max-width:360px;width:90%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.5)">
      <div style="font-size:16px;font-weight:800;margin-bottom:8px;color:#f2f2f5">Continue with Google</div>
      <div style="font-size:13px;color:#9b9db0;margin-bottom:20px">Choose your Google account to sign in securely.</div>
      <div id="xe-google-render" style="display:flex;justify-content:center;min-height:44px"></div>
      <button type="button" id="xe-google-cancel" style="margin-top:16px;background:none;border:none;color:#9b9db0;font-size:13px;cursor:pointer">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('xe-google-cancel').onclick = () => {
    overlay.remove();
    finish(Object.assign(new Error('GOOGLE_CANCELLED'), { code: 'GOOGLE_CANCELLED' }));
  };
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      overlay.remove();
      if (response?.credential) finish(null, response.credential);
      else finish(Object.assign(new Error('GOOGLE_CANCELLED'), { code: 'GOOGLE_CANCELLED' }));
    },
    auto_select: false,
  });
  window.google.accounts.id.renderButton(document.getElementById('xe-google-render'), {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: 300,
  });
}

export const AuthManager = {
  get configured() { return true; /* same-origin /api always available */ },
  get currentUser() { return currentUser; },
  userDTO: dto,

  async signUp(name, email, password, username) {
    const r = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, username }),
    });
    localStorage.setItem('xe3agle_token', r.token);
    currentUser = dto(r.user);
    listeners.forEach(f => f(currentUser));
    return currentUser;
  },

  /** Login uses username + password (email only required at signup). */
  async signIn(username, password) {
    const r = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('xe3agle_token', r.token);
    currentUser = dto(r.user);
    listeners.forEach(f => f(currentUser));
    return currentUser;
  },

  async signInWithGoogle() {
    const clientId = await ensureGoogleClientId();
    const idToken = await obtainGoogleIdToken(clientId);
    const r = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    localStorage.setItem('xe3agle_token', r.token);
    currentUser = dto(r.user);
    listeners.forEach(f => f(currentUser));
    return currentUser;
  },

  async signOut() {
    localStorage.removeItem('xe3agle_token');
    currentUser = null;
    try { window.google?.accounts?.id?.disableAutoSelect?.(); } catch (_) {}
    listeners.forEach(f => f(null));
  },

  async resetPassword(email) {
    return api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },

  async confirmReset(token, password) {
    return api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
  },

  async changePassword(newPassword, currentPassword) {
    return api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
  },

  async changeEmail(email, password) {
    return api('/api/auth/change-email', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  async deleteAccount() {
    await api('/api/account', { method: 'DELETE' });
    await this.signOut();
  },

  onChange(fn) {
    listeners.push(fn);
    return () => { listeners = listeners.filter(x => x !== fn); };
  },

  async boot() { return bootFromToken(); },
};
