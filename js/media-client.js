/**
 * XE3AGLE v20 — cloud screenshot media client
 * Uploads to Render API → Neon; serves via authenticated URL.
 */
import { api, apiBase } from './auth/api-client.js';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.78;
const MAX_DATA_URL_CHARS = 2.2 * 1024 * 1024;

function authToken() {
  return localStorage.getItem('xe3agle_token') || '';
}

/** Resize + compress image File/Blob → data URL (jpeg) */
export function compressImage(file, { maxEdge = MAX_EDGE, quality = JPEG_QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('NO_FILE'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(url);
        if (dataUrl.length > MAX_DATA_URL_CHARS) {
          // second pass more aggressive
          const dataUrl2 = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl2.length < dataUrl.length ? dataUrl2 : dataUrl);
        } else {
          resolve(dataUrl);
        }
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    img.src = url;
  });
}

/** Absolute media URL usable in <img src> (includes access_token) */
export function mediaViewUrl(mediaId) {
  if (!mediaId) return '';
  const base = apiBase(); // may be '' for same-origin proxy
  const token = encodeURIComponent(authToken());
  return `${base}/api/media/${mediaId}?access_token=${token}`;
}

/**
 * Resolve display URL for a trade screenshot field.
 * Supports: media id, relative /api/media/…, full URL, or legacy data: URL.
 */
export function resolveScreenshotSrc(value) {
  if (!value) return '';
  const v = String(value);
  if (v.startsWith('data:image/')) return v;
  if (v.startsWith('http://') || v.startsWith('https://')) {
    // attach token if our API media path
    if (v.includes('/api/media/') && !v.includes('access_token=')) {
      const token = authToken();
      return token ? `${v}${v.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}` : v;
    }
    return v;
  }
  if (v.startsWith('/api/media/')) {
    return mediaViewUrl(v.split('/').pop().split('?')[0]);
  }
  // assume UUID media id
  if (/^[0-9a-f-]{36}$/i.test(v)) return mediaViewUrl(v);
  return v;
}

/** Upload data URL to cloud; returns { id, url } */
export async function uploadScreenshot(dataUrl, { tradeId = '', filename = 'screenshot.jpg' } = {}) {
  if (!authToken()) throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
  // same-origin proxy allowed when apiBase() is empty string
  if (apiBase() === null || apiBase() === undefined) throw Object.assign(new Error('API_NOT_CONFIGURED'), { code: 'API_NOT_CONFIGURED' });
  const r = await api('/api/media', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, tradeId, filename }),
  });
  return {
    id: r.id,
    url: mediaViewUrl(r.id),
    path: r.url,
    byteSize: r.byteSize,
  };
}

/** File → compress → cloud upload */
export async function uploadScreenshotFile(file, opts = {}) {
  const dataUrl = await compressImage(file);
  return uploadScreenshot(dataUrl, {
    tradeId: opts.tradeId || '',
    filename: (file.name || 'screenshot').replace(/\.[^.]+$/, '') + '.jpg',
  });
}

export async function deleteMedia(id) {
  if (!id) return;
  try {
    await api(`/api/media/${id}`, { method: 'DELETE' });
  } catch (_) {}
}

// Global helpers for legacy code
window.XE3AGLE_MEDIA = {
  compressImage,
  uploadScreenshot,
  uploadScreenshotFile,
  resolveScreenshotSrc,
  mediaViewUrl,
  deleteMedia,
};
