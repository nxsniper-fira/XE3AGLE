/* ── StorageManager v20 ── */
/* Handles read, write, corruption recovery, backup keys */

const KEY   = 'xe3agle_state';
const BK1   = 'xe3agle_state_bk1';   // rolling backup
const BK2   = 'xe3agle_state_bk2';   // older backup
const PRIV  = 'xe3agle_privacy';

export const StorageManager = {
  key: KEY,

  /* Read — returns null on corruption, never throws */
  read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('CORRUPT');
      return parsed;
    } catch {
      console.warn('[XE3AGLE] Primary state corrupt — attempting backup restore');
      return this._restoreBackup();
    }
  },

  /* Write — also rolls backups */
  write(v) {
    try {
      // Roll backup before overwriting
      const prev = localStorage.getItem(KEY);
      if (prev) {
        try { localStorage.setItem(BK2, localStorage.getItem(BK1) || prev); } catch {}
        try { localStorage.setItem(BK1, prev); } catch {}
      }
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch (e) {
      console.error('[XE3AGLE] Storage write failed:', e);
    }
  },

  clear() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BK1);
    localStorage.removeItem(BK2);
  },

  /* Try backups in order */
  _restoreBackup() {
    for (const k of [BK1, BK2]) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          console.warn(`[XE3AGLE] Restored from backup key: ${k}`);
          localStorage.setItem(KEY, raw); // promote backup to primary
          return parsed;
        }
      } catch {}
    }
    console.error('[XE3AGLE] All backups corrupt. Starting fresh.');
    return null;
  },

  /* Privacy persisted separately so it survives state reload */
  readPrivacy() {
    try { return JSON.parse(localStorage.getItem(PRIV) || '{"hidden":false}'); } catch { return { hidden: false }; }
  },
  writePrivacy(v) {
    try { localStorage.setItem(PRIV, JSON.stringify(v)); } catch {}
  },
};

window.XE3AGLE_STORAGE = StorageManager;
