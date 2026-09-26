/**
 * API client — uses same-origin /api when API_BASE is empty (Vercel proxy).
 */
function resolveApiBase() {
  const configured = String(window.XE3AGLE_CONFIG?.API_BASE ?? '').trim().replace(/\/$/, '');
  if (configured && !/YOUR[-_A-Z]*|example\.com|\.invalid|placeholder/i.test(configured)) {
    return configured;
  }
  // Empty string = same origin (preferred). Relative paths like /api/auth/login
  if (configured === '' || window.XE3AGLE_CONFIG?.API_BASE === '') {
    return '';
  }
  const saved = String(localStorage.getItem('xe3agle_api_base') || '').trim().replace(/\/$/, '');
  if (saved && !/YOUR[-_A-Z]*|example\.com|\.invalid|placeholder/i.test(saved)) {
    return saved;
  }
  return '';
}

export function apiBase() {
  return resolveApiBase();
}

export async function api(path, options = {}) {
  const base = resolveApiBase();
  // path must start with /api/...
  const url = path.startsWith('http') ? path : (base + path);

  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem('xe3agle_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      mode: 'cors',
      credentials: 'omit',
    });
  } catch (cause) {
    const e = new Error('API_UNREACHABLE');
    e.code = 'API_UNREACHABLE';
    e.cause = cause;
    throw e;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_) {}

  if (!res.ok) {
    const e = new Error(data?.error || `HTTP_${res.status}`);
    e.status = res.status;
    e.code = data?.error || `HTTP_${res.status}`;
    throw e;
  }
  return data;
}
