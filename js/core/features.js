/* ── XE3AGLE v20 Features ──────────────────────────────────────────
   Streak tracker, daily P&L target bar, trade confidence score,
   keyboard shortcuts, light/dark toggle, public trade card,
   coach link, referral, offline queue, conflict resolution UI,
   weekly review enforcement, rule violation heatmap.
 ──────────────────────────────────────────────────────────────────── */

import { AuthManager }  from '../auth/auth-manager.js';
import { StorageManager } from './storage-manager.js';

const $  = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => { try { return window.formatCurrency ? window.formatCurrency(Number(v) || 0, window.state?.settings?.currency || 'USD') : (Number(v) || 0).toFixed(2); } catch { return '0.00'; } };
const st  = () => window.state || {};
const save = () => window.saveState?.();
const trades = () => Array.isArray(st().trades) ? st().trades : [];
const closed = () => trades().filter(t => t.result && String(t.tradeType || '').toLowerCase() !== 'live');
const isoToday = () => new Date().toISOString().slice(0, 10);
const uid = () => { try { return crypto.randomUUID(); } catch { return 'id-' + Date.now().toString(36); } };

/* ── Offline queue ─────────────────────────────────────────────── */
const QUEUE_KEY = 'xe3agle_offline_queue';
function queueRead() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } }
function queueWrite(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {} }

export function queueSync(payload) {
  // Keep an ordered, bounded queue; associate it with the signed-in user so
  // one account's offline edits can never be replayed into another account.
  const userId = AuthManager?.user?.id || AuthManager?.currentUser?.id || 'unresolved-user';
  const q = queueRead().filter(item => item.userId === userId);
  q.push({ id: uid(), userId, payload: structuredCloneSafe(payload), at: Date.now() });
  queueWrite(q.slice(-500));
}
function structuredCloneSafe(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}

export async function flushOfflineQueue() {
  if (!navigator.onLine) return;
  const userId = AuthManager?.user?.id || AuthManager?.currentUser?.id || 'unresolved-user';
  const all = queueRead();
  const mine = all.filter(item => item.userId === userId);
  if (!mine.length) return;
  const remaining = [];
  for (const item of mine) {
    try {
      if (!item.payload) throw new Error('Queued payload is empty');
      // Send the exact queued snapshot. The sync implementation must accept
      // an explicit payload; otherwise retain it rather than falsely deleting it.
      if (typeof window.xe3agleSyncPayload === 'function') {
        await window.xe3agleSyncPayload(item.payload, { queueId: item.id, modifiedAt: item.at });
      } else {
        throw new Error('Payload-aware sync endpoint is not configured');
      }
    } catch {
      remaining.push(item);
    }
  }
  const otherUsers = all.filter(item => item.userId !== userId);
  queueWrite([...otherUsers, ...remaining]);
  if (mine.length && !remaining.length) window.toast?.('Offline changes synced.', 'success');
}

window.addEventListener('online', () => {
  window.toast?.('Back online — syncing…', 'info');
  setTimeout(flushOfflineQueue, 1500);
});
window.addEventListener('offline', () => window.toast?.('You are offline. Changes will sync when reconnected.', 'error'));

/* ── Conflict resolution UI ────────────────────────────────────── */
export function showConflictDialog(localState, remoteState, onKeepLocal, onKeepRemote) {
  if ($('xe19-conflict-modal')) return;
  const localTrades  = (localState.trades  || []).length;
  const remoteTrades = (remoteState.trades || []).length;
  const localDate    = new Date(localState.sync?.modifiedAt  || 0).toLocaleString();
  const remoteDate   = new Date(remoteState.sync?.modifiedAt || 0).toLocaleString();

  const modal = document.createElement('div');
  modal.id = 'xe19-conflict-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--red-border);border-radius:16px;padding:28px;max-width:460px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.7)">
      <div style="font-size:16px;font-weight:800;color:var(--red);margin-bottom:6px">⚠ Sync Conflict Detected</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:20px">Two versions of your data exist. Choose which one to keep. The other will be discarded.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:14px">
          <div style="font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">This Device</div>
          <div style="font-size:20px;font-weight:800">${localTrades} trades</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Modified ${localDate}</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:14px">
          <div style="font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Cloud</div>
          <div style="font-size:20px;font-weight:800">${remoteTrades} trades</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Modified ${remoteDate}</div>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button id="xe19-keep-local"  style="flex:1;padding:11px;border-radius:9px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);cursor:pointer;font-weight:700;font-size:13px">Keep This Device</button>
        <button id="xe19-keep-remote" style="flex:1;padding:11px;border-radius:9px;background:var(--accent);color:#0a0800;border:none;cursor:pointer;font-weight:800;font-size:13px">Keep Cloud</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  $('xe19-keep-local').onclick  = () => { modal.remove(); onKeepLocal?.();  };
  $('xe19-keep-remote').onclick = () => { modal.remove(); onKeepRemote?.(); };
}

/* ── Streak tracker ────────────────────────────────────────────── */
function updateStreaks() {
  const v19 = st().v19;
  if (!v19) return;
  const today = isoToday();
  const todayTrades = closed().filter(t => String(t.date || '').slice(0, 10) === today);
  const greenToday  = todayTrades.length > 0 && todayTrades.every(t => t.result === 'WIN' || Number(t.resultR || 0) > 0);
  const rulesOk     = !st().killSwitch && st().workflowStage !== 'terminated';

  if (greenToday) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    v19.streaks.greenDays  = v19.streaks.lastGreenDate === yStr ? (v19.streaks.greenDays || 0) + 1 : 1;
    v19.streaks.lastGreenDate = today;
    v19.streaks.bestGreen  = Math.max(v19.streaks.bestGreen || 0, v19.streaks.greenDays);
  }
  if (rulesOk) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    v19.streaks.rulesDays  = v19.streaks.lastRulesDate === yStr ? (v19.streaks.rulesDays || 0) + 1 : (v19.streaks.rulesDays || 0);
    v19.streaks.lastRulesDate = today;
    v19.streaks.bestRules  = Math.max(v19.streaks.bestRules || 0, v19.streaks.rulesDays);
  }
  save();
}

export function renderStreakWidget(hostId) {
  const host = $(hostId);
  if (!host) return;
  updateStreaks();
  const v19 = st().v19 || {};
  const s   = v19.streaks || {};
  host.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      ${[
        ['🟢 Green Days', s.greenDays || 0, 'day streak'],
        ['📏 Rules Days', s.rulesDays || 0, 'day streak'],
        ['🏆 Best Green', s.bestGreen || 0, 'day record'],
        ['🏅 Best Rules', s.bestRules || 0, 'day record'],
      ].map(([label, val, sub]) => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">${label}</div>
          <div style="font-size:28px;font-weight:900;color:var(--accent)">${val}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${sub}</div>
        </div>`).join('')}
    </div>`;
}

/* ── Daily P&L target bar ──────────────────────────────────────── */
export function renderDailyTargetBar(hostId) {
  const host = $(hostId);
  if (!host) return;
  const settings = st().settings || {};
  const target   = Number(settings.dailyTarget || 0);
  const todayPL  = closed()
    .filter(t => String(t.date || '').slice(0, 10) === isoToday())
    .reduce((a, t) => a + (Number(t.resultPL) || 0), 0);

  if (!target) {
    host.innerHTML = `<div style="font-size:11px;color:var(--text3)">Set a daily P&L target in Settings to track progress here.</div>`;
    return;
  }

  const pct    = Math.min(100, Math.max(0, (todayPL / target) * 100));
  const over   = todayPL >= target;
  const color  = over ? 'var(--green)' : todayPL < 0 ? 'var(--red)' : 'var(--accent)';

  host.innerHTML = `
    <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:11px;font-weight:700;color:var(--text2)">DAILY TARGET PROGRESS</div>
      <div style="font-size:11px;font-weight:800;color:${color}">${money(todayPL)} / ${money(target)}</div>
    </div>
    <div style="height:8px;background:var(--surface2);border-radius:99px;overflow:hidden;border:1px solid var(--border)">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width .4s ease"></div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:5px">${over ? '🎯 Target reached — consider stopping for today.' : `${(100 - pct).toFixed(0)}% remaining`}</div>`;
}

/* ── Trade confidence score ────────────────────────────────────── */
export function renderConfidenceStats(hostId) {
  const host = $(hostId);
  if (!host) return;
  const conf = trades().filter(t => t.confidence && t.result);
  if (!conf.length) {
    host.innerHTML = `<div style="font-size:12px;color:var(--text3)">No confidence data yet. Score trades 1–10 when adding them.</div>`;
    return;
  }
  const buckets = { HIGH: { wins: 0, total: 0 }, MED: { wins: 0, total: 0 }, LOW: { wins: 0, total: 0 } };
  for (const t of conf) {
    const c = Number(t.confidence);
    const b = c >= 8 ? 'HIGH' : c >= 5 ? 'MED' : 'LOW';
    buckets[b].total++;
    if (t.result === 'WIN') buckets[b].wins++;
  }
  host.innerHTML = `
    <div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:10px">CONFIDENCE → WIN RATE</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${Object.entries(buckets).map(([label, { wins, total }]) => {
        const wr = total ? Math.round((wins / total) * 100) : 0;
        const color = wr >= 60 ? 'var(--green)' : wr >= 40 ? 'var(--amber)' : 'var(--red)';
        return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:12px;text-align:center">
          <div style="font-size:10px;color:var(--text3);margin-bottom:5px">${label} (${total})</div>
          <div style="font-size:22px;font-weight:900;color:${color}">${wr}%</div>
          <div style="font-size:10px;color:var(--text3)">${wins}W / ${total - wins}L</div>
        </div>`;
      }).join('')}
    </div>`;
}

/* ── Rule violation heatmap ────────────────────────────────────── */
export function renderViolationHeatmap(hostId) {
  const host = $(hostId);
  if (!host) return;
  const counts = {};
  for (const t of closed()) {
    for (const v of (t.violations || [])) {
      const k = String(v).trim();
      if (k) counts[k] = (counts[k] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    host.innerHTML = `<div style="font-size:12px;color:var(--text3)">No violations logged yet. Keep it that way. 💪</div>`;
    return;
  }
  const max = sorted[0][1];
  host.innerHTML = `
    <div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:10px">RULE VIOLATIONS — MOST FREQUENT</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${sorted.slice(0, 10).map(([rule, count]) => {
        const pct = (count / max) * 100;
        const color = pct > 70 ? 'var(--red)' : pct > 40 ? 'var(--amber)' : 'var(--text3)';
        return `<div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:12px">
            <span>${esc(rule)}</span><span style="font-weight:700;color:${color}">${count}×</span>
          </div>
          <div style="height:6px;background:var(--surface2);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width .3s"></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

/* ── Trade replay timeline ─────────────────────────────────────── */
export function renderTradeTimeline(hostId, date) {
  const host = $(hostId);
  if (!host) return;
  const day = (date || isoToday()).slice(0, 10);
  const dayTrades = closed().filter(t => String(t.date || '').slice(0, 10) === day)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

  if (!dayTrades.length) {
    host.innerHTML = `<div style="font-size:12px;color:var(--text3)">No trades on ${day}.</div>`;
    return;
  }

  host.innerHTML = `
    <div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:12px">TRADE REPLAY — ${esc(day)}</div>
    <div style="position:relative;padding-left:24px">
      <div style="position:absolute;left:10px;top:0;bottom:0;width:2px;background:var(--border)"></div>
      ${dayTrades.map((t, i) => {
        const color = t.result === 'WIN' ? 'var(--green)' : t.result === 'LOSS' ? 'var(--red)' : 'var(--amber)';
        return `<div style="position:relative;margin-bottom:14px">
          <div style="position:absolute;left:-19px;top:4px;width:10px;height:10px;border-radius:50%;background:${color};border:2px solid var(--bg)"></div>
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:10px 12px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:12px;font-weight:700">${esc(t.direction)} · ${esc(t.setup || t.entryModel || 'No setup')}</div>
              <div style="font-size:11px;font-weight:800;color:${color}">${t.result} · ${Number(t.resultR || 0).toFixed(2)}R</div>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">${esc(t.time || '')} · E:${esc(t.entry)} SL:${esc(t.sl)} TP:${esc(t.tp)}</div>
            ${t.notes ? `<div style="font-size:11px;color:var(--text2);margin-top:4px;font-style:italic">${esc(t.notes.slice(0, 100))}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

/* ── Keyboard shortcuts ────────────────────────────────────────── */
const SHORTCUTS = [
  { key: 'n', label: 'New trade',     action: () => $('btn-add-trade')?.click() },
  { key: 'j', label: 'Journal',       action: () => window.navigate?.('journal') },
  { key: 'a', label: 'Analytics',     action: () => window.navigate?.('analytics') },
  { key: 't', label: 'Today',         action: () => window.navigate?.('today') },
  { key: 's', label: 'Sync',          action: () => window.xe3agleSync?.() },
  { key: 'p', label: 'Prepare',       action: () => window.navigate?.('prepare') },
  { key: 'b', label: 'Toggle privacy',action: () => window.toggleBalancePrivacy?.() },
  { key: '?', label: 'Show shortcuts',action: () => showShortcutsModal() },
];

function showShortcutsModal() {
  if ($('xe19-shortcuts-modal')) { $('xe19-shortcuts-modal').remove(); return; }
  const modal = document.createElement('div');
  modal.id = 'xe19-shortcuts-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:14px;padding:28px;max-width:380px;width:100%">
      <div style="font-size:16px;font-weight:800;margin-bottom:16px;display:flex;justify-content:space-between">
        Keyboard Shortcuts <button id="xe19-shortcuts-close" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${SHORTCUTS.map(s => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:13px;color:var(--text2)">${s.label}</span>
            <kbd style="background:var(--surface2);border:1px solid var(--border2);border-radius:5px;padding:2px 8px;font-family:monospace;font-size:12px">${s.key}</kbd>
          </div>`).join('')}
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:14px">Press Esc or ? to close</div>
    </div>`;
  document.body.appendChild(modal);
  $('xe19-shortcuts-close').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (!st().v19?.shortcuts) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { $('xe19-shortcuts-modal')?.remove(); return; }
    const sc = SHORTCUTS.find(s => s.key === e.key.toLowerCase());
    if (sc) { e.preventDefault(); sc.action(); }
  });
}

/* ── Light / dark mode ─────────────────────────────────────────── */
export function toggleLightMode() {
  const v19 = st().v19 || {};
  /* theme via ThemeManager */ 
}

export function applyLightMode(_on){ /* themes handled by ThemeManager */ }

export function initLightMode(){ /* themes handled by ThemeManager */ }

/* ── Public trade card (share image) ──────────────────────────── */
export async function generateTradeCard(tradeId) {
  const trade = trades().find(t => String(t.id) === String(tradeId));
  if (!trade) return window.toast?.('Trade not found.', 'error');

  const color  = trade.result === 'WIN' ? '#16c97a' : trade.result === 'LOSS' ? '#f0434a' : '#f5a623';
  const symbol = trade.result === 'WIN' ? '✓' : trade.result === 'LOSS' ? '✗' : '—';

  const canvas = document.createElement('canvas');
  canvas.width  = 800;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#07080a';
  ctx.fillRect(0, 0, 800, 420);

  // Accent line
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 6, 420);

  // Brand
  ctx.fillStyle = '#f7c444';
  ctx.font = '700 22px monospace';
  ctx.fillText('XE3AGLE', 36, 50);

  // Result symbol
  ctx.fillStyle = color;
  ctx.font = '900 80px sans-serif';
  ctx.fillText(symbol, 36, 170);

  // Result label
  ctx.font = '800 36px sans-serif';
  ctx.fillText(trade.result || 'BREAKEVEN', 36, 220);

  // Details
  ctx.fillStyle = '#8a8ba0';
  ctx.font = '400 18px sans-serif';
  ctx.fillText(`${trade.direction || ''} · ${trade.setup || trade.entryModel || 'No setup'} · ${trade.date || ''}`, 36, 270);
  ctx.fillText(`Entry: ${trade.entry}  SL: ${trade.sl}  TP: ${trade.tp}  R: ${Number(trade.resultR || 0).toFixed(2)}`, 36, 305);

  // P&L
  ctx.fillStyle = color;
  ctx.font = '800 28px monospace';
  ctx.fillText(`${Number(trade.resultR || 0) >= 0 ? '+' : ''}${Number(trade.resultR || 0).toFixed(2)}R`, 36, 360);

  ctx.fillStyle = '#3a3a4a';
  ctx.font = '400 14px sans-serif';
  ctx.fillText('xe3agle.app', 36, 400);

  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `xe3agle-trade-${trade.date || 'card'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    window.toast?.('Trade card downloaded.', 'success');
  });
}

/* ── Coach link UI ─────────────────────────────────────────────── */
export async function generateCoachLink() {
  try {
    const { api } = await import('../auth/api-client.js');
    const { url } = await api('/api/coach-link', { method: 'POST', body: '{}' });
    await navigator.clipboard.writeText(url).catch(() => {});
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border2);border-radius:14px;padding:28px;max-width:440px;width:100%">
        <div style="font-size:16px;font-weight:800;margin-bottom:8px">Coach View Link</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:14px">Your coach can view your journal (read-only). Link expires in 90 days.</div>
        <input value="${esc(url)}" readonly style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:10px;color:var(--text);font-family:monospace;font-size:12px;box-sizing:border-box">
        <div style="font-size:11px;color:var(--green);margin-top:8px">✓ Copied to clipboard</div>
        <button onclick="this.closest('[style]').remove()" style="margin-top:14px;padding:9px 20px;background:var(--accent);color:#0a0800;border:none;border-radius:8px;font-weight:800;cursor:pointer">Close</button>
      </div>`;
    document.body.appendChild(modal);
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
  } catch (e) {
    window.toast?.(e.message?.includes('NOT_CONFIGURED') ? 'Coach links require the backend to be running.' : 'Could not generate coach link.', 'error');
  }
}

/* ── Referral UI ───────────────────────────────────────────────── */
export function showReferralModal() {
  if ($('xe19-referral-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'xe19-referral-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:14px;padding:28px;max-width:400px;width:100%">
      <div style="font-size:16px;font-weight:800;margin-bottom:6px">Invite a Trader</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:16px">Invite a fellow trader to XE3AGLE. They'll get full access.</div>
      <input id="xe19-invite-email" type="email" placeholder="their@email.com"
        style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:11px;color:var(--text);font-size:14px;box-sizing:border-box">
      <div style="display:flex;gap:8px;margin-top:12px">
        <button id="xe19-send-invite" style="flex:1;padding:11px;background:var(--accent);color:#0a0800;border:none;border-radius:8px;font-weight:800;cursor:pointer">Send Invite</button>
        <button onclick="document.getElementById('xe19-referral-modal').remove()" style="padding:11px 16px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;cursor:pointer;color:var(--text)">Cancel</button>
      </div>
      <div id="xe19-invite-status" style="font-size:12px;margin-top:10px"></div>
    </div>`;
  document.body.appendChild(modal);

  $('xe19-send-invite').onclick = async () => {
    const email = $('xe19-invite-email')?.value.trim();
    if (!email) return;
    try {
      const { api } = await import('../auth/api-client.js');
      await api('/api/referral/invite', { method: 'POST', body: JSON.stringify({ email }) });
      $('xe19-invite-status').style.color = 'var(--green)';
      $('xe19-invite-status').textContent = `✓ Invite sent to ${email}`;
      $('xe19-invite-email').value = '';
    } catch (e) {
      $('xe19-invite-status').style.color = 'var(--red)';
      $('xe19-invite-status').textContent = e.message?.includes('NOT_CONFIGURED') ? 'Email not configured on your server.' : 'Could not send invite.';
    }
  };
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

/* ── Weekly review enforcement ─────────────────────────────────── */
export function checkWeeklyReview() {
  const v16 = st().v16 || {};
  const reviews = v16.reviews?.weekly || [];
  if (!reviews.length) return;
  const lastReview = reviews[reviews.length - 1];
  const daysSince  = Math.floor((Date.now() - new Date(lastReview.date || 0)) / 86400000);
  if (daysSince >= 7) {
    window.toast?.('📋 Weekly review due — complete your reflection before trading.', 'error');
  }
}

/* ── Animated equity curve ─────────────────────────────────────── */
export function drawAnimatedEquity(canvas, trades) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.clientWidth  || 600;
  const h   = canvas.clientHeight || 220;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const style = getComputedStyle(document.documentElement);
  const green  = style.getPropertyValue('--green').trim()  || '#16c97a';
  const border = style.getPropertyValue('--border').trim() || '#21222a';
  const text3  = style.getPropertyValue('--text3').trim()  || '#44455a';
  const accent = style.getPropertyValue('--accent').trim() || '#f7c444';

  const sorted = [...(trades || [])].sort((a, b) => new Date(a.date + 'T' + (a.time || '12:00')) - new Date(b.date + 'T' + (b.time || '12:00')));
  const start  = Number(window.state?.settings?.balance) || 0;
  let bal = start, peak = start;
  const points = [start, ...sorted.map(t => { bal += Number(t.resultPL) || 0; peak = Math.max(peak, bal); return bal; })];

  if (points.length < 2) {
    ctx.fillStyle = text3;
    ctx.font = '13px sans-serif';
    ctx.fillText('No closed trades yet.', 16, 30);
    return;
  }

  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const px = (i) => 12 + (w - 24) * (i / (points.length - 1));
  const py = (v) => 14 + (h - 36) * (1 - (v - min) / range);

  // Grid
  ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
  for (let i = 0; i <= 4; i++) {
    const y = 14 + (h - 36) * (i / 4);
    ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(w - 12, y); ctx.stroke();
    ctx.fillStyle = text3; ctx.font = '10px sans-serif';
    ctx.fillText(money(max - (range * i / 4)), 14, y - 4);
  }
  ctx.setLineDash([]);

  // Fill
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0,   'rgba(22,201,122,.18)');
  gradient.addColorStop(1,   'rgba(22,201,122,.0)');
  ctx.beginPath();
  ctx.moveTo(px(0), py(points[0]));
  points.forEach((v, i) => ctx.lineTo(px(i), py(v)));
  ctx.lineTo(px(points.length - 1), h);
  ctx.lineTo(px(0), h);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line — animated draw
  let progress = 0;
  const totalLen = points.length - 1;
  function frame() {
    progress = Math.min(progress + totalLen / 40, totalLen);
    ctx.clearRect(0, 0, w, h);

    // Redraw grid
    ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    for (let i = 0; i <= 4; i++) {
      const y = 14 + (h - 36) * (i / 4);
      ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(w - 12, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    const end = Math.floor(progress);
    ctx.strokeStyle = green; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= end; i++) {
      const x = px(i), y = py(points[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Dot at current position
    if (end > 0) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(px(end), py(points[end]), 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (progress < totalLen) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ── Init (called once after auth) ────────────────────────────── */
export function initFeatures() {
  initKeyboardShortcuts();
  initLightMode();
  checkWeeklyReview();
  flushOfflineQueue();
  window.xe19 = {
    renderStreakWidget, renderDailyTargetBar, renderConfidenceStats,
    renderViolationHeatmap, renderTradeTimeline, generateTradeCard,
    generateCoachLink, showReferralModal, drawAnimatedEquity,
    toggleLightMode, showShortcutsModal, showConflictDialog,
  };
}
