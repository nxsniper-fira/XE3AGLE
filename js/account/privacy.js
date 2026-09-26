/* Balance privacy — hide/show money across the app */
import { StorageManager } from '../core/storage-manager.js';

let _hidden = false;

function moneySelectors() {
  return document.querySelectorAll([
    '#today-balance',
    '.balance-value',
    '.xe-balance-field',
    '[data-balance]',
    '.metric-value', // will filter currency-looking ones
  ].join(','));
}

function looksLikeMoney(text) {
  const t = String(text || '').trim();
  if (!t || t === '••••••') return true;
  return /[$€£¥]|^\+?-?[\d,]+\.?\d*$/.test(t.replace(/\s/g, ''));
}

function applyPrivacy() {
  // Header balance
  const todayBal = document.getElementById('today-balance');
  if (todayBal) {
    if (_hidden) {
      if (!todayBal.dataset.originalText || todayBal.textContent !== '••••••') {
        if (todayBal.textContent !== '••••••') todayBal.dataset.originalText = todayBal.textContent;
      }
      todayBal.textContent = '••••••';
      todayBal.classList.add('balance-hidden');
    } else {
      if (todayBal.dataset.originalText) todayBal.textContent = todayBal.dataset.originalText;
      todayBal.classList.remove('balance-hidden');
    }
  }

  document.querySelectorAll('.balance-value, .xe-balance-field, [data-balance]').forEach((el) => {
    if (_hidden) {
      if (el.textContent !== '••••••') el.dataset.originalText = el.textContent;
      el.textContent = '••••••';
      el.classList.add('balance-hidden');
    } else {
      if (el.dataset.originalText) el.textContent = el.dataset.originalText;
      el.classList.remove('balance-hidden');
    }
  });

  // Metric cards that show currency
  document.querySelectorAll('.metric-value, .stat-value').forEach((el) => {
    const txt = el.textContent || '';
    if (_hidden) {
      if (looksLikeMoney(txt) && txt !== '••••••') {
        el.dataset.originalText = txt;
        el.textContent = '••••••';
        el.classList.add('balance-hidden');
      }
    } else if (el.classList.contains('balance-hidden') && el.dataset.originalText) {
      el.textContent = el.dataset.originalText;
      el.classList.remove('balance-hidden');
    }
  });

  document.querySelectorAll('.balance-toggle, #balance-privacy-toggle').forEach((btn) => {
    btn.classList.toggle('is-hidden', _hidden);
    btn.setAttribute('aria-label', _hidden ? 'Show balances' : 'Hide balances');
    btn.setAttribute('title', _hidden ? 'Show balances' : 'Hide balances');
  });
}

export function initPrivacy() {
  try {
    _hidden = !!(StorageManager.readPrivacy()?.hidden);
  } catch {
    _hidden = false;
  }
  applyPrivacy();
}

export function togglePrivacy() {
  _hidden = !_hidden;
  try {
    StorageManager.writePrivacy({ hidden: _hidden });
  } catch (_) {}
  applyPrivacy();
  window.toast?.(_hidden ? 'Balances hidden.' : 'Balances visible.', 'info');
}

export function isPrivacyOn() {
  return _hidden;
}

export function refreshPrivacy() {
  applyPrivacy();
}

window.toggleBalancePrivacy = togglePrivacy;
window.initPrivacy = initPrivacy;
window.refreshPrivacy = refreshPrivacy;
window.isPrivacyOn = isPrivacyOn;
