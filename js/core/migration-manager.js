import { SCHEMA_VERSION } from '../../data/schema.js';

function deviceId() {
  try {
    const k = 'xe3agle_device_id';
    let v = localStorage.getItem(k);
    if (!v) { v = 'dev-' + crypto.randomUUID(); localStorage.setItem(k, v); }
    return v;
  } catch { return 'dev-session'; }
}

export function migrateState(state) {
  const s = structuredClone(state || {});

  // Core
  s._schemaVersion  = Math.max(Number(s._schemaVersion) || 0, SCHEMA_VERSION);
  s.auth            = s.auth || { signedIn: false, user: null };
  s.accountId       = s.accountId || 'main';
  s.accountMeta     = s.accountMeta || { name: 'Main Account', type: 'FUNDED' };
  s.settings        = s.settings || {};
  s.trades          = Array.isArray(s.trades) ? s.trades : [];
  s.dailyHistory    = Array.isArray(s.dailyHistory) ? s.dailyHistory : [];
  s.psychologyHistory = Array.isArray(s.psychologyHistory) ? s.psychologyHistory : [];
  s.auditLog        = Array.isArray(s.auditLog) ? s.auditLog : [];

  // Sync
  s.sync = s.sync || {};
  s.sync.modifiedAt   = Number(s.sync.modifiedAt)   || Date.now();
  s.sync.lastSyncedAt = Number(s.sync.lastSyncedAt) || 0;
  s.sync.status       = s.sync.status  || 'local';
  s.sync.lastError    = s.sync.lastError || '';

  // UI
  s.ui = s.ui || {};
  s.ui.theme = s.ui.theme || 'obsidian';

  // v16 block
  s.v16 = s.v16 || {};
  s.v16.reviews    = s.v16.reviews    || { weekly: [], monthly: [] };
  s.v16.tags       = Array.isArray(s.v16.tags)   ? s.v16.tags   : [];
  s.v16.media      = Array.isArray(s.v16.media)  ? s.v16.media  : [];
  s.v16.audit      = Array.isArray(s.v16.audit)  ? s.v16.audit  : [];
  s.v16.imports    = s.v16.imports    || { lastPreview: null };
  s.v16.challenge  = s.v16.challenge  || { enabled: false, profitTarget: 0, trailingDrawdown: 0, initialBalance: Number(s.settings?.balance) || 0, payouts: [] };
  s.v16.protection = s.v16.protection || { daily: 0, weekly: 0, monthly: 0, trailing: 0 };
  s.v16.deviceId   = s.v16.deviceId   || deviceId();
  s.v16.deviceName = s.v16.deviceName || ((typeof navigator !== 'undefined' ? navigator.platform : 'Browser') + ' • ' + new Date().toLocaleDateString());

  // v19 additions
  s.v19 = s.v19 || {};
  s.v19.streaks    = s.v19.streaks    || { greenDays: 0, rulesDays: 0, bestGreen: 0, bestRules: 0, lastGreenDate: '', lastRulesDate: '' };
  s.v19.weeklyGoal = s.v19.weeklyGoal || { target: 0, notes: '' };
  s.v19.confidence = Array.isArray(s.v19.confidence) ? s.v19.confidence : [];
  s.v19.shortcuts  = s.v19.shortcuts  !== false;   // enabled by default
  s.v19.lightMode  = s.v19.lightMode  || false;

  return s;
}
