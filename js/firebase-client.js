/**
 * XE3AGLE v20 — compatibility layer.
 * Auth/state: Render + Neon. Media: /api/media (see media-client.js).
 */
export const db = null;
export const storage = null;
export const isFirebaseConfigured = false;

export const ref = (path) => ({ fullPath: String(path || '') });
export const uploadBytes = async (refObj, bytes) => {
  // Legacy callers: convert bytes to data URL and use cloud media if available
  if (!window.XE3AGLE_MEDIA?.uploadScreenshot) {
    throw new Error('MEDIA_BACKEND_NOT_CONFIGURED');
  }
  let dataUrl;
  if (typeof bytes === 'string' && bytes.startsWith('data:')) dataUrl = bytes;
  else {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes]);
    dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  const up = await window.XE3AGLE_MEDIA.uploadScreenshot(dataUrl, { filename: 'upload.jpg' });
  return { ref: refObj, mediaId: up.id, url: up.url };
};
export const getDownloadURL = async (refObj) => {
  const id = refObj?.mediaId || String(refObj?.fullPath || '').split('/').pop();
  if (window.XE3AGLE_MEDIA?.mediaViewUrl && id) return window.XE3AGLE_MEDIA.mediaViewUrl(id);
  throw new Error('MEDIA_NOT_FOUND');
};
export const listAll = async () => ({ items: [], prefixes: [] });
export const deleteObject = async () => {};
export const doc = () => null;
export const setDoc = async () => {};
export const getDoc = async () => ({ exists: () => false });
export const deleteDoc = async () => {};
export const collection = () => null;
export const getDocs = async () => ({ docs: [] });
export const query = (...x) => x;
export const orderBy = () => null;
export const serverTimestamp = () => new Date().toISOString();
export const runTransaction = async () => {};
