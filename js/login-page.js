/**
 * XE3AGLE — login / sign-up (API URL is set in api-config.js)
 */
import { AuthManager } from './auth/auth-manager.js';
import { apiBase } from './auth/api-client.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const nextUrl = params.get('next') || '/app.html';
const startMode = params.get('mode') === 'signup' ? 'signup' : params.get('mode') === 'reset' ? 'reset' : 'login';
const resetToken = params.get('reset_token') || '';

function authError(e) {
  const code = e?.code || e?.message || '';
  return ({
    API_NOT_CONFIGURED: 'Server is not connected. Please try again later.',
    API_UNREACHABLE: 'Cannot reach the server. It may be waking up — wait about a minute and try again.',
    INVALID_CREDENTIALS: 'Incorrect username or password.',
    USERNAME_EXISTS: 'That username is already taken.',
    INVALID_USERNAME: 'Username must be at least 3 characters (letters, numbers, underscore).',
    EMAIL_EXISTS: 'An account with this email already exists.',
    WEAK_PASSWORD: 'Password must be at least 8 characters.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    GOOGLE_OAUTH_NOT_CONFIGURED: 'Google sign-in is not available. Use email and password.',
    GOOGLE_CANCELLED: 'Google sign-in was cancelled.',
    GOOGLE_SCRIPT_FAILED: 'Could not load Google sign-in. Try email and password.',
    INVALID_GOOGLE_TOKEN: 'Google sign-in failed. Try again.',
    INVALID_GOOGLE_AUDIENCE: 'Google sign-in is misconfigured.',
    GOOGLE_EMAIL_UNVERIFIED: 'Your Google email is not verified.',
    USE_GOOGLE_SIGNIN: 'This account uses Google. Click Continue with Google.',
    EMAIL_NOT_CONFIGURED: 'Password reset email is not available right now.',
    TOKEN_EXPIRED: 'This reset link has expired. Request a new one.',
    TOKEN_USED_OR_EXPIRED: 'This reset link was already used or expired.',
    TOO_MANY_REQUESTS: 'Too many attempts. Wait a minute and try again.',
  }[code] || e?.message || 'Something went wrong. Please try again.');
}

function setStatus(text, type = 'info') {
  const el = $('auth-status');
  if (!el) return;
  el.textContent = text;
  el.className = `auth-status ${type}`;
}

function goApp() {
  location.replace('/app');
}

function renderGate(root) {
  root.innerHTML = `
    <div class="xe-auth-gate visible" id="xe-auth-gate" style="display:block">
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
            <div class="xe-auth-sub" id="auth-sub">Sign in to open your tools.</div>
            <form id="xe-auth-form" autocomplete="on">
              <div id="auth-name-field" class="input-group" hidden>
                <input id="auth-name" type="text" placeholder="Full name (optional)" maxlength="80" autocomplete="name">
              </div>
              <div id="auth-email-field" class="input-group" hidden>
                <input id="auth-email" type="email" autocomplete="email" placeholder="Email address">
              </div>
              <div class="input-group" id="auth-username-field">
                <input id="auth-username" type="text" required autocomplete="username" placeholder="Username" minlength="3" maxlength="32" pattern="[A-Za-z0-9_]+" title="Letters, numbers, underscore">
              </div>
              <div class="input-group password-group" id="auth-pw-group">
                <input id="auth-password" type="password" minlength="8" required autocomplete="current-password" placeholder="Password">
                <button id="auth-password-toggle" class="auth-password-toggle" type="button">SHOW</button>
              </div>
              <div class="auth-row" id="auth-options-row">
                <span></span>
                <button class="auth-link" id="auth-forgot" type="button">Forgot password?</button>
              </div>
              <button class="auth-primary" id="auth-submit" type="submit">Sign in</button>
            </form>
            <div class="auth-divider"><span>or</span></div>
            <button class="auth-google" id="auth-google" type="button">Continue with Google</button>
            <button class="auth-switch" id="auth-switch" type="button">
              <span id="auth-switch-text">Need an account? <strong>Sign up</strong></span>
            </button>
            <div id="auth-status" class="auth-status"></div>
            <div style="margin-top:12px;text-align:center">
              <a href="/index.html" class="auth-link" style="font-size:12px">← Back to home</a>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  let mode = startMode;

  function renderMode() {
    const isSignup = mode === 'signup';
    const isReset = mode === 'reset';
    $('auth-heading').textContent = isReset ? 'Reset password' : isSignup ? 'Create account' : 'Welcome back';
    $('auth-sub').textContent = isReset
      ? 'Enter your email and we will send a reset link if mail is enabled.'
      : isSignup
        ? 'Sign up with email, username, and password.'
        : 'Sign in with your username and password.';
    $('auth-name-field').hidden = !isSignup;
    const emailField = $('auth-email-field');
    if (emailField) emailField.hidden = !(isSignup || isReset);
    const userField = $('auth-username-field');
    if (userField) userField.hidden = isReset;
    const emailInp = $('auth-email');
    if (emailInp) emailInp.required = isSignup || isReset;
    const userInp = $('auth-username');
    if (userInp) userInp.required = !isReset;
    $('auth-pw-group').hidden = isReset;
    $('auth-options-row').hidden = isReset || isSignup;
    $('auth-submit').textContent = isReset ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in';
    $('auth-switch-text').innerHTML = isSignup
      ? 'Already have an account? <strong>Sign in</strong>'
      : 'Need an account? <strong>Sign up</strong>';
    const google = $('auth-google');
    const div = document.querySelector('.auth-divider');
    if (google) google.style.display = isReset ? 'none' : '';
    if (div) div.style.display = isReset ? 'none' : '';
  }

  $('auth-switch').onclick = () => {
    mode = mode === 'login' ? 'signup' : 'login';
    setStatus('', 'info');
    renderMode();
  };
  $('auth-forgot').onclick = () => {
    mode = 'reset';
    setStatus('', 'info');
    renderMode();
  };
  $('auth-password-toggle').onclick = () => {
    const inp = $('auth-password');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    $('auth-password-toggle').textContent = show ? 'HIDE' : 'SHOW';
  };

  $('auth-google').onclick = async () => {
    const btn = $('auth-google');
    btn.disabled = true;
    setStatus('Opening Google…', 'info');
    try {
      await AuthManager.signInWithGoogle();
      goApp();
    } catch (e) {
      setStatus(authError(e), 'error');
      btn.disabled = false;
    }
  };

  $('xe-auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('auth-submit');
    btn.disabled = true;
    btn.textContent = mode === 'signup' ? 'Creating…' : mode === 'reset' ? 'Sending…' : 'Signing in…';
    setStatus('', 'info');
    try {
      if (mode === 'reset') {
        await AuthManager.resetPassword($('auth-email').value);
        setStatus('If that email exists, a reset link was sent.', 'success');
      } else if (mode === 'signup') {
        await AuthManager.signUp($('auth-name').value, $('auth-email').value, $('auth-password').value, $('auth-username').value);
        goApp();
      } else {
        await AuthManager.signIn($('auth-username').value, $('auth-password').value);
        goApp();
      }
    } catch (err) {
      setStatus(authError(err), 'error');
    } finally {
      btn.disabled = false;
      renderMode();
    }
  };

  if (resetToken) {
    root.querySelector('.xe-auth-panel').innerHTML = `
      <div class="xe-auth-heading">Set new password</div>
      <div class="xe-auth-sub">Choose a new password for your account.</div>
      <form id="xe-reset-form">
        <div class="input-group" style="margin-bottom:12px">
          <input id="reset-password" type="password" minlength="8" required placeholder="New password" autocomplete="new-password">
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
        setStatus('Password updated — you can sign in.', 'success');
        setTimeout(() => { location.href = '/login.html'; }, 1500);
      } catch (e) {
        setStatus(authError(e), 'error');
      }
    };
    return;
  }

  renderMode();
}

async function main() {
  const root = document.getElementById('login-root');
  try {
    if (apiBase()) {
      const u = await AuthManager.boot();
      if (u) {
        goApp();
        return;
      }
    }
  } catch (_) {}
  renderGate(root);
}

main();
