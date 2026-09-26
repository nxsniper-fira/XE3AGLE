import { AuthManager }   from './auth/auth-manager.js';
import { SyncManager }   from './auth/sync-manager.js';
import { migrateState }  from './core/migration-manager.js';
import { StorageManager } from './core/storage-manager.js';
import { ThemeManager }  from './ui/theme-manager.js';
import { ProductionSuite } from './production-suite.js';
import { V16 }           from './v16-production.js';
import { initFeatures, showConflictDialog, queueSync, flushOfflineQueue, initLightMode } from './core/features.js';
import { initPrivacy, refreshPrivacy } from './account/privacy.js';
import './media-client.js';

const App = { user: null, ready: false, hydrating: false, syncTimer: null, saveWrapped: false };
const $   = id => document.getElementById(id);
const toastSafe = (m, t = 'info') => window.toast?.(m, t);

/* ── Local save ── */
function localSave() {
  try {
    if (window.state) StorageManager.write(window.state);
  } catch {}
}

/* ── Auth gate status ── */
function setStatus(text, type = 'info') {
  const el = $('auth-status');
  if (!el) return;
  el.textContent = text;
  el.className   = `auth-status ${type}`;
}

function authError(e) {
  return ({
    API_NOT_CONFIGURED:               'The XE3AGLE API URL is not configured. Deploy the backend and set API_BASE in api-config.js.',
    API_UNREACHABLE:                   'Cannot reach the XE3AGLE server. Check that the backend is running and its CORS origin includes this website.',
    USERNAME_EXISTS: 'That username is already taken.',
    INVALID_USERNAME: 'Username must be at least 3 characters (letters, numbers, underscore).',
    INVALID_CREDENTIALS:              'Incorrect username or password.',
    EMAIL_EXISTS:                     'An account with this email already exists.',
    WEAK_PASSWORD:                    'Password must be at least 8 characters.',
    INVALID_EMAIL:                    'Please enter a valid email address.',
    GOOGLE_OAUTH_NOT_CONFIGURED:      'Google sign-in is not configured. Add GOOGLE_CLIENT_ID on the server.',
    GOOGLE_CANCELLED:                 'Google sign-in was cancelled.',
    GOOGLE_SCRIPT_FAILED:             'Could not load Google sign-in. Check your network.',
    INVALID_GOOGLE_TOKEN:             'Google sign-in failed. Please try again.',
    INVALID_GOOGLE_AUDIENCE:          'Google client ID mismatch. Check GOOGLE_CLIENT_ID.',
    GOOGLE_EMAIL_UNVERIFIED:          'Your Google email is not verified.',
    USE_GOOGLE_SIGNIN:                'This account uses Google. Click Continue with Google.',
    EMAIL_NOT_CONFIGURED:             'Email is not configured on this server. Contact the site admin.',
    TOKEN_EXPIRED:                    'This reset link has expired. Request a new one.',
    TOKEN_USED_OR_EXPIRED:            'This reset link has already been used or expired.',
  }[e?.code || e?.message] || e?.message || 'Authentication failed. Please try again.');
}

/* ── Lock / unlock ── */
function lockApp() {
  document.body.classList.add('auth-locked');
  const gate = $('xe-auth-gate');
  if (gate) { gate.style.display = ''; gate.classList.add('visible'); }
}

function unlockApp() {
  const gate = $('xe-auth-gate');
  if (gate) { gate.classList.remove('visible'); setTimeout(() => { gate.style.display = 'none'; }, 300); }
  document.body.classList.remove('auth-locked');
}

/* ── Login gate ── */
function installLoginGate() {
  if ($('xe-auth-gate')) return;
  const gate = document.createElement('div');
  gate.id        = 'xe-auth-gate';
  gate.className = 'xe-auth-gate';
  gate.innerHTML = `
    <div class="xe-auth-wrapper">
      <div class="xe-auth-brandline">
        <img class="xe-auth-logo xe-logo-image" src="assets/icons/xe3agle-logo.png" alt="XE3AGLE" width="48" height="48">
        <div class="xe-auth-brandtext">
          <div class="xe-auth-name">XE3AGLE</div>
          <div class="xe-auth-tagline">Discipline Over Impulse</div>
        </div>
      </div>
      <div class="xe-auth-formwrap">
        <div class="xe-auth-panel">
          <div class="xe-auth-heading" id="auth-heading">Welcome back</div>
          <div class="xe-auth-sub"    id="auth-sub">Sign in to your trading journal.</div>

          <form id="xe-auth-form" autocomplete="on">
            <div id="auth-name-field" class="input-group" hidden>
              <input id="auth-name" type="text" placeholder="Full name" maxlength="80" autocomplete="name">
            </div>
            <div class="input-group">
              <input id="auth-email" type="email" required autocomplete="email" placeholder="Email address">
            </div>
            <div class="input-group password-group" id="auth-pw-group">
              <input id="auth-password" type="password" minlength="8" required autocomplete="current-password" placeholder="Password">
              <button id="auth-password-toggle" class="auth-password-toggle" type="button">SHOW</button>
            </div>

            <div class="auth-row" id="auth-options-row">
              <span class="auth-secure-note">Secured · Encrypted</span>
              <button class="auth-link" id="auth-forgot" type="button">Forgot password?</button>
            </div>

            <button class="auth-primary" id="auth-submit" type="submit">Sign in</button>
          </form>

          <div class="auth-divider"><span>or</span></div>
          <button class="auth-google" id="auth-google" type="button">Continue with Google</button>
          <button class="auth-switch" id="auth-switch" type="button">
            Don't have an account? <strong>Sign up free</strong>
          </button>

          <div id="auth-status" class="auth-status"></div>
        </div>
        <div class="xe-auth-footer">XE3AGLE &nbsp;·&nbsp; Private cloud &nbsp;·&nbsp; Your data stays yours</div>
      </div>
    </div>`;
  document.body.appendChild(gate);

  /* Mode toggle */
  let mode = 'login';
  const renderMode = () => {
    const isSignup  = mode === 'signup';
    const isReset   = mode === 'reset';
    $('auth-heading').textContent = isSignup ? 'Create account' : isReset ? 'Reset password' : 'Welcome back';
    $('auth-sub').textContent     = isSignup
      ? 'Sign up with email, username, and password.'
      : isReset
        ? "Enter your email and we'll send a reset link."
        : 'Sign in with your username and password.';
    $('auth-submit').textContent  = isSignup ? 'Create account' : isReset ? 'Send reset link' : 'Sign in';
    $('auth-name-field').hidden   = !isSignup;
    const emailField = $('auth-email-field');
    if (emailField) emailField.hidden = !(isSignup || isReset);
    const userField = $('auth-username-field');
    if (userField) userField.hidden = isReset;
    const emailInp = $('auth-email');
    if (emailInp) emailInp.required = isSignup || isReset;
    const userInp = $('auth-username');
    if (userInp) userInp.required = !isReset;
    $('auth-pw-group').hidden     = isReset;
    if ($('auth-forgot')) $('auth-forgot').hidden = isSignup || isReset;
    $('auth-options-row').hidden  = isReset;
    $('auth-switch').innerHTML    = isSignup
      ? 'Already have an account? <strong>Sign in</strong>'
      : isReset ? 'Back to <strong>Sign in</strong>'
      : "Don't have an account? <strong>Sign up free</strong>";
    const google = $('auth-google');
    const div = document.querySelector('.auth-divider');
    if (google) google.style.display = isReset ? 'none' : '';
    if (div) div.style.display = isReset ? 'none' : '';
  };

  $('auth-switch').onclick = () => {
    mode = mode === 'login' ? 'signup' : 'login';
    renderMode();
  };
  $('auth-forgot').onclick = () => { mode = 'reset'; renderMode(); };

  $('auth-password-toggle').onclick = () => {
    const inp  = $('auth-password');
    const show = inp.type === 'password';
    inp.type   = show ? 'text' : 'password';
    $('auth-password-toggle').textContent = show ? 'HIDE' : 'SHOW';
  };

  $('auth-google').onclick = async () => {
    const btn = $('auth-google');
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Connecting to Google…';
    setStatus('Opening Google sign-in…');
    try {
      await AuthManager.signInWithGoogle();
      setStatus('Signed in with Google.', 'success');
    } catch (e) {
      setStatus(authError(e), 'error');
      btn.disabled = false;
      btn.textContent = prev;
    }
  };

  $('xe-auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('auth-submit');
    btn.disabled    = true;
    btn.textContent = mode === 'signup' ? 'Creating…' : mode === 'reset' ? 'Sending…' : 'Signing in…';
    setStatus(mode === 'reset' ? 'Sending reset link…' : mode === 'signup' ? 'Creating your account…' : 'Signing in…');
    try {
      if (mode === 'reset') {
        await AuthManager.resetPassword($('auth-email').value);
        setStatus('Reset link sent — check your email.', 'success');
        btn.disabled    = false;
        btn.textContent = 'Send reset link';
        return;
      }
      if (mode === 'signup') await AuthManager.signUp($('auth-name').value, $('auth-email').value, $('auth-password').value, $('auth-username').value);
      else                   await AuthManager.signIn($('auth-username').value, $('auth-password').value);
    } catch (err) {
      setStatus(authError(err), 'error');
      btn.disabled    = false;
      btn.textContent = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in';
    }
  };

  /* Check for password reset token in URL */
  const params     = new URLSearchParams(location.search);
  const resetToken = params.get('reset_token');
  if (resetToken) {
    gate.querySelector('.xe-auth-panel').innerHTML = `
      <div class="xe-auth-heading">Set New Password</div>
      <div class="xe-auth-sub">Choose a new password for your account.</div>
      <form id="xe-reset-form">
        <div class="input-group" style="margin-bottom:16px">
          <input id="reset-password"  type="password" minlength="8" required placeholder="New password (min 8 chars)" autocomplete="new-password">
        </div>
        <div class="input-group" style="margin-bottom:16px">
          <input id="reset-password2" type="password" minlength="8" required placeholder="Confirm new password" autocomplete="new-password">
        </div>
        <button class="auth-primary" type="submit">Set password</button>
        <div id="auth-status" class="auth-status" style="margin-top:12px"></div>
      </form>`;
    $('xe-reset-form').onsubmit = async (ev) => {
      ev.preventDefault();
      const p1 = $('reset-password')?.value;
      const p2 = $('reset-password2')?.value;
      if (p1 !== p2) return setStatus('Passwords do not match.', 'error');
      try {
        await AuthManager.confirmReset(resetToken, p1);
        setStatus('Password updated — you can now sign in.', 'success');
        setTimeout(() => { history.replaceState({}, '', location.pathname); location.reload(); }, 2000);
      } catch (e) { setStatus(authError(e), 'error'); }
    };
  }
}

/* ── Account topbar UI ── */
function installAccountUI() {
  const top = document.querySelector('.topbar-status');
  if (top && !$('xe-account-menu')) {
    const b = document.createElement('div');
    b.id        = 'xe-account-menu';
    b.className = 'xe-account-menu';
    b.innerHTML = `
      <span id="xe-account-email"></span>
      <button class="btn btn-sm" id="xe-account-signout">Log out</button>`;
    top.prepend(b);
    $('xe-account-signout').onclick = async () => {
      try { await syncNow(false); } catch {}
      await AuthManager.signOut();
      location.replace('/');
    };
  }
}

function renderAccount(u) {
  if ($('xe-account-email')) $('xe-account-email').textContent = u?.email || '';
}

/* ── Cloud save wrapper ── */
function installCloudSave() {
  if (App.saveWrapped || !window.saveState) return;
  const old = window.saveState;
  window.saveState = function () {
    if (window.state && !App.hydrating) {
      state.sync = state.sync || {};
      state.sync.modifiedAt = Date.now();
    }
    old();
    if (!App.hydrating && App.user) scheduleCloudSave();
    refreshPrivacy(); // keep privacy state applied after re-renders
  };
  App.saveWrapped = true;
}

let saveTimer;
function scheduleCloudSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (navigator.onLine) syncNow(false);
    else queueSync(structuredClone(window.state));
  }, 700);
}

/* ── Sync ── */
async function syncNow(manual = true) {
  if (!App.user) return;
  try {
    state.sync                = state.sync || {};
    state.sync.modifiedAt     = Number(state.sync.modifiedAt) || Date.now();
    const r = await SyncManager.push(App.user, state, state.accountId || 'main', {
      version:      state.sync.version || 0,
      lastSyncedAt: state.sync.lastSyncedAt || 0,
    });
    state.sync.lastSyncedAt = Date.now();
    state.sync.version      = r.version;
    state.sync.status       = 'synced';
    localSave();
    if (manual) toastSafe('Saved to your XE3AGLE account.', 'success');
  } catch (e) {
    if (e.code === 'SYNC_CONFLICT') {
      /* Fetch the server state that came back with the 409 */
      const remoteState = e.serverState ? migrateState(e.serverState) : null;
      if (remoteState) {
        const localSnap = structuredClone(state);
        showConflictDialog(
          localSnap, remoteState,
          /* keep local */ async () => {
            state.sync.modifiedAt = Date.now() + 1; // force our version ahead
            await syncNow(false);
            toastSafe('Kept your local version.', 'success');
          },
          /* keep remote */ () => {
            localStorage.setItem('xe3agle_conflict_backup_' + Date.now(), JSON.stringify(localSnap));
            window.state = remoteState;
            localSave();
            window.renderAll?.();
            toastSafe('Loaded cloud version. Local backup saved.', 'info');
          }
        );
      }
    } else if (manual) {
      toastSafe('Cloud save failed. Local data is safe.', 'error');
    }
  }
}

/* ── Hydrate after login ── */
async function hydrateUser(u) {
  App.hydrating = true;
  App.user      = u;

  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('SYNC_TIMEOUT'), { code: 'SYNC_TIMEOUT' })), ms)),
  ]);

  try {
    let remote = null;
    try {
      remote = await withTimeout(SyncManager.pull(), 5000);
    } catch (pullErr) {
      console.warn('Cloud pull skipped:', pullErr?.code || pullErr?.message || pullErr);
      remote = null;
    }

    if (remote?.payload) {
      const remoteState = migrateState(remote.payload);
      const localRaw    = StorageManager.read();
      const localState  = localRaw ? migrateState(localRaw) : null;

      if (localState && localState.sync?.modifiedAt > (remoteState.sync?.modifiedAt || 0) && localState.trades?.length) {
        window.state = remoteState;
        localSave();
        showConflictDialog(
          localState, remoteState,
          async () => {
            window.state = localState;
            localSave();
            try { await syncNow(false); } catch (_) {}
            window.renderAll?.();
          },
          () => {
            window.state = remoteState;
            localSave();
            window.renderAll?.();
          }
        );
      } else {
        window.state = remoteState;
        localSave();
      }
    } else {
      const localRaw = StorageManager.read();
      if (localRaw) {
        window.state = migrateState(localRaw);
      } else {
        window.state = migrateState({});
      }
      window.state.auth      = { signedIn: true, user: AuthManager.userDTO(u) };
      window.state.accountId = window.state.accountId || 'main';
      window.state.sync      = window.state.sync || { modifiedAt: Date.now(), lastSyncedAt: 0, status: 'local' };
      localSave();
      try { await withTimeout(syncNow(false), 5000); } catch (_) {}
    }
  } catch (e) {
    console.warn('hydrateUser:', e);
    const localRaw = StorageManager.read();
    window.state   = localRaw ? migrateState(localRaw) : migrateState({});
    try { toastSafe('Cloud sync unavailable. Using local data.', 'error'); } catch (_) {}
  }

  App.hydrating = false;
  App.ready     = true;

  try { ThemeManager.init(); } catch (e) { console.warn('ThemeManager', e); }
  try { initPrivacy(); } catch (e) { console.warn('privacy', e); }
  try { initLightMode(); } catch (e) { console.warn('light', e); }

  try { window.renderAll?.(); } catch (e) { console.warn('renderAll', e); }
  try { refreshPrivacy(); } catch (_) {}
  try { renderAccount(u); } catch (_) {}
  unlockApp(); // ALWAYS show dashboard UI
  try { installAccountUI(); } catch (_) {}
  try { installCloudSave(); } catch (_) {}

  try { await ProductionSuite.init(); } catch (e) { console.warn('ProductionSuite:', e); }
  try { V16.init(); } catch (e) { console.warn('V16:', e); }
  try { initFeatures(); } catch (e) { console.warn('features', e); }

  if (App.syncTimer) clearInterval(App.syncTimer);
  App.syncTimer = setInterval(() => { if (navigator.onLine) syncNow(false); }, 60_000);
  setTimeout(() => { try { flushOfflineQueue(); } catch (_) {} }, 2000);
}


/* ── Boot ── */
async function boot() {
  const path = location.pathname || '';
  const onApp = document.body?.dataset?.xeApp === '1'
    || /\/app(\.html)?$/i.test(path)
    || /(^|\/)app(\.html)?$/i.test(path.split('/').pop() || '');

  lockApp();
  try {
    const u = await AuthManager.boot();
    if (!u) {
      if (onApp) {
        location.replace('/login?next=' + encodeURIComponent('/app'));
        return;
      }
      installLoginGate();
      const gate = $('xe-auth-gate');
      if (gate) gate.classList.add('visible');
    } else {
      await hydrateUser(u);
    }
  } catch (e) {
    console.error('boot error', e);
    // Still show UI with local data so users never get a permanent black screen
    try {
      const localRaw = StorageManager.read();
      window.state = localRaw ? migrateState(localRaw) : migrateState({});
      window.renderAll?.();
    } catch (_) {}
    unlockApp();
    try { toastSafe('Loaded offline. Some cloud features may be unavailable.', 'error'); } catch (_) {}
  }

  AuthManager.onChange(async user => {
    try {
      if (user) {
        await hydrateUser(user);
      } else {
        lockApp();
        if (onApp) location.replace('/login');
      }
    } catch (e) {
      console.error('auth change', e);
      unlockApp();
    }
  });
}

/* ── Globals ── */
window.xe3agleSync     = () => syncNow(true);
window.xe3agleSignOut  = async () => { try { await syncNow(false); } catch {} await AuthManager.signOut(); location.replace('/'); };
window.xe3agleAuth     = () => AuthManager.signInWithGoogle();
window.xe3agleSendFeedback = async (category, message) => {
  const { api } = await import('./auth/api-client.js');
  return api('/api/feedback', { method: 'POST', body: JSON.stringify({ category, message }) });
};

boot();
