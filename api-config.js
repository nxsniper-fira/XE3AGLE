/* XE3AGLE — API is proxied through the same website (/api → Render).
 * Users never paste a URL. Login works same-origin (no CORS pain).
 */
window.XE3AGLE_CONFIG = {
  // Empty = same website (Vercel proxies /api/* to https://xe3agle.onrender.com)
  API_BASE: '',
};
