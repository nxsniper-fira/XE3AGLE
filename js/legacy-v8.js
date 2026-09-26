
// ============================================================
// STATE
// ============================================================
const DEFAULT_SETTINGS = {
  balance: 10000, currency: 'USD', instrument: '',
  risk: 0.5, dailyLoss: 1, target: 2, maxTrades: 3,
  maxConsecLoss: 2, minRR: 2, ptval: 1,
  timezone: 'America/New_York', dateFormat: 'MM/DD/YYYY',
  londonOpen: '03:00', nyOpen: '07:00', asiaOpen: '19:00'
};

let state = {
  settings: {...DEFAULT_SETTINGS},
  currentDay: null, // YYYY-MM-DD
  preparation: { emotion: '', focus: '', news: '', markets: '', rulesAccepted: false },
  analysis: { biasDir: '', biasHTF: '', biasETF: '', biasNotes: '', liquidity: [], liquidityNotes: '', sweep: false, sweepNotes: '', mss: false, mssNotes: '', entryModel: '', direction: '', entry: '', sl: '', tp: '', ptval: '' },
  activeTrade: null,
  trades: [],
  dailyHistory: [],
  psychology: { reflection: '' },
  dailyReview: {},
  killSwitch: false,
  killReason: '',
  ui: { page: 'today' },
  tradeEditId: null,
  reviewAnswers: {},
  screenshotData: null,
};

// ============================================================
// STORAGE
// ============================================================

// Cloud screenshot helpers (v20)
function xeScreenshotSrc(v) {
  try {
    if (window.XE3AGLE_MEDIA?.resolveScreenshotSrc) return window.XE3AGLE_MEDIA.resolveScreenshotSrc(v);
  } catch (_) {}
  return v || '';
}
async function xeUploadScreenshotFile(file, tradeId) {
  if (!file) return null;
  if (window.XE3AGLE_MEDIA?.uploadScreenshotFile) {
    try {
      const r = await window.XE3AGLE_MEDIA.uploadScreenshotFile(file, { tradeId: tradeId || '' });
      return r.id; // store media id in trade.screenshot
    } catch (e) {
      console.warn('Cloud upload failed, falling back to local', e);
      // fallback local data URL (compressed if possible)
      try {
        if (window.XE3AGLE_MEDIA?.compressImage) {
          return await window.XE3AGLE_MEDIA.compressImage(file);
        }
      } catch (_) {}
    }
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let d = e.target.result;
      if (d && d.length > 2 * 1024 * 1024) d = null;
      resolve(d);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function saveState() {
  try { localStorage.setItem('xe3agle_state', JSON.stringify(state)); } catch(e) { toast('Storage error: ' + e.message, 'error'); }
}

function loadState() {
  try {
    const raw = localStorage.getItem('xe3agle_state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    state = deepMerge(state, saved);
    // Ensure risk-rule presets exist if older saves omitted them
    const d = DEFAULT_SETTINGS;
    const s = state.settings || (state.settings = {});
    if (s.risk == null || s.risk === '') s.risk = d.risk;
    if (s.dailyLoss == null || s.dailyLoss === '') s.dailyLoss = d.dailyLoss;
    if (s.target == null || s.target === '') s.target = d.target;
    if (s.maxTrades == null || s.maxTrades === '') s.maxTrades = d.maxTrades;
    if (s.maxConsecLoss == null || s.maxConsecLoss === '') s.maxConsecLoss = d.maxConsecLoss;
    if (s.minRR == null || s.minRR === '') s.minRR = d.minRR;
  } catch(e) {
    console.warn('XE3AGLE: Could not load state', e);
  }
}

function deepMerge(target, source) {
  const result = {...target};
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ============================================================
// DAY RESET
// ============================================================
function getTodayKey() {
  const now = new Date();
  const tz = state.settings.timezone || 'UTC';
  const str = now.toLocaleDateString('en-CA', { timeZone: tz });
  return str;
}

function checkDayReset() {
  const todayKey = getTodayKey();
  if (state.currentDay === todayKey) return; // already correct day — no reset needed
  // Archive the previous day's trades before wiping
  if (state.currentDay) {
    const prevTrades = state.trades.filter(t => t.date === state.currentDay);
    const existing = state.dailyHistory.find(d => d.date === state.currentDay);
    if (!existing && prevTrades.length > 0) {
      archiveDay(state.currentDay);
    }
  }
  // New day — reset daily state only
  state.currentDay = todayKey;
  state.preparation = { emotion: '', focus: '', news: '', markets: '', rulesAccepted: false };
  state.analysis = { biasDir: '', biasHTF: '', biasETF: '', biasNotes: '', liquidity: [], liquidityNotes: '', sweep: false, sweepNotes: '', mss: false, mssNotes: '', entryModel: '', direction: '', entry: '', sl: '', tp: '', ptval: '' };
  state.activeTrade = null;
  state.killSwitch = false;
  state.killReason = '';
  saveState();
}

function archiveDay(dateKey) {
  const trades = state.trades.filter(t => t.date === dateKey);
  if (!trades.length) return;
  const totalR = trades.reduce((s, t) => s + (parseFloat(t.resultR) || 0), 0);
  const wins = trades.filter(t => t.result === 'WIN').length;
  const losses = trades.filter(t => t.result === 'LOSS').length;
  const violations = trades.filter(t => t.violation == 1).length;
  state.dailyHistory.push({ date: dateKey, totalR: parseFloat(totalR.toFixed(2)), trades: trades.length, wins, losses, violations });
}

// ============================================================
// STATUS ENGINE
// ============================================================
function getDailyTrades() { return state.trades.filter(t => t.date === state.currentDay); }

function getDailyR() {
  return getDailyTrades().reduce((s, t) => {
    if (t.result === 'BREAKEVEN') return s;
    return s + (parseFloat(t.resultR) || 0);
  }, 0);
}

function getDailyPL() {
  return getDailyTrades().reduce((s, t) => s + (parseFloat(t.resultPL) || 0), 0);
}

function getConsecLosses() {
  const trades = getDailyTrades().filter(t => t.result !== 'BREAKEVEN');
  let count = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].result === 'LOSS') count++;
    else break;
  }
  return count;
}

function getStopReasons() {
  const s = state.settings;
  const dailyR = getDailyR();
  const trades = getDailyTrades();
  const consecLoss = getConsecLosses();
  const reasons = [];

  if (state.killSwitch) reasons.push('Kill switch active: ' + (state.killReason || 'Manual'));
  if (getDailyPL() <= -(s.balance * s.dailyLoss / 100)) reasons.push('Daily loss limit reached (' + (-s.dailyLoss).toFixed(1) + '%)');
  if (consecLoss >= s.maxConsecLoss) reasons.push('Max consecutive losses reached (' + s.maxConsecLoss + ')');
  if (dailyR >= s.target) reasons.push('Daily target reached (+' + s.target + 'R)');
  if (trades.length >= s.maxTrades) reasons.push('Maximum trades completed (' + s.maxTrades + ')');
  return reasons;
}

function isStopped() { return getStopReasons().length > 0; }

function getTradingStatus() {
  if (state.activeTrade) return 'TRADE_ACTIVE';
  if (isStopped()) return 'TERMINATED';
  const ct = canTrade();
  if (ct.allowed) return 'TRADE_APPROVED';
  if (!state.preparation.rulesAccepted) return 'PREPARATION';
  const analysisComplete = state.analysis.biasDir && state.analysis.sweep && state.analysis.mss && state.analysis.entryModel;
  if (!analysisComplete) return 'ANALYSIS';
  return 'WAITING';
}

function canTrade() {
  const s = state.settings;
  const reasons = [];
  const stops = getStopReasons();
  if (stops.length) return { allowed: false, reasons: stops };

  if (!state.preparation.emotion) reasons.push('Mental state not recorded');
  if (!state.preparation.rulesAccepted) reasons.push('Rules not acknowledged');
  if (!state.analysis.biasDir) reasons.push('Bias not selected');
  if (!state.analysis.liquidity || state.analysis.liquidity.length === 0) reasons.push('Liquidity not identified');
  if (!state.analysis.sweep) reasons.push('Liquidity sweep not confirmed');
  if (!state.analysis.mss) reasons.push('MSS not confirmed');
  if (!state.analysis.entryModel) reasons.push('Entry model not selected');
  if (!state.analysis.direction) reasons.push('Trade direction not set');
  if (!state.analysis.entry || isNaN(parseFloat(state.analysis.entry))) reasons.push('Entry price missing');
  if (!state.analysis.sl || isNaN(parseFloat(state.analysis.sl))) reasons.push('Stop loss missing');
  if (!state.analysis.tp || isNaN(parseFloat(state.analysis.tp))) reasons.push('Take profit missing');

  // Risk validation
  const risk = calcRiskValues();
  if (risk) {
    if (risk.rr < s.minRR) reasons.push('RR below minimum (' + risk.rr.toFixed(2) + ' < ' + s.minRR + ':1)');
  } else {
    if (state.analysis.entry && state.analysis.sl && state.analysis.tp) reasons.push('Invalid price values for risk calculation');
  }

  return { allowed: reasons.length === 0, reasons };
}

// ============================================================
// RISK CALCULATION
// ============================================================
function calcRiskValues() {
  try {
    const s = state.settings;
    const entry = parseFloat(state.analysis.entry || document.getElementById('trade-entry')?.value);
    const sl = parseFloat(state.analysis.sl || document.getElementById('trade-sl')?.value);
    const tp = parseFloat(state.analysis.tp || document.getElementById('trade-tp')?.value);
    const dir = state.analysis.direction;
    const ptval = parseFloat(state.analysis.ptval || document.getElementById('trade-ptval')?.value || s.ptval || 1);
    const balance = s.balance;
    const riskPct = s.risk;

    if (!entry || !sl || !tp || isNaN(entry) || isNaN(sl) || isNaN(tp)) return null;

    const riskAmount = balance * riskPct / 100;
    const stopDist = Math.abs(entry - sl);
    const targetDist = Math.abs(tp - entry);
    const rr = stopDist > 0 ? targetDist / stopDist : 0;

    // Determine direction from prices if not set
    const priceDir = dir === 'LONG' ? 1 : (dir === 'SHORT' ? -1 : (sl < entry ? 1 : -1));
    const isLong = priceDir === 1;
    const slValid = isLong ? sl < entry : sl > entry;
    const tpValid = isLong ? tp > entry : tp < entry;

    const potentialLoss = -riskAmount;
    const potentialProfit = riskAmount * rr;

    return { riskAmount, stopDist, targetDist, rr, potentialLoss, potentialProfit, riskPct };
  } catch(e) { return null; }
}

function calcRisk() {
  // Read from form fields during setup
  const entryEl = document.getElementById('trade-entry');
  const slEl = document.getElementById('trade-sl');
  const tpEl = document.getElementById('trade-tp');
  const ptEl = document.getElementById('trade-ptval');
  const dirEls = document.querySelectorAll('#trade-direction .radio-btn');
  const selDir = [...dirEls].find(b => b.classList.contains('selected'))?.dataset?.val || '';

  if (entryEl) state.analysis.entry = entryEl.value;
  if (slEl) state.analysis.sl = slEl.value;
  if (tpEl) state.analysis.tp = tpEl.value;
  if (ptEl) state.analysis.ptval = ptEl.value;
  if (selDir) state.analysis.direction = selDir;

  renderRiskCalc();
}

function renderRiskCalc() {
  const el = document.getElementById('risk-calc-result');
  if (!el) return;
  const r = calcRiskValues();
  const s = state.settings;
  if (!r) {
    el.innerHTML = '<div class="text-muted text-xs">Enter entry, stop loss, and take profit to calculate risk.</div>';
    return;
  }
  const rrOk = r.rr >= s.minRR;
  const riskOk = true; // risk% is from settings, always valid
  const cur = s.currency;
  el.innerHTML = `
    <div class="calc-result">
      <div class="calc-row"><span>Risk Amount</span><span>${formatCurrency(r.riskAmount, cur)}</span></div>
      <div class="calc-row"><span>Risk %</span><span>${r.riskPct.toFixed(2)}%</span></div>
      <div class="calc-row"><span>Stop Distance</span><span>${r.stopDist.toFixed(4)}</span></div>
      <div class="calc-row"><span>Target Distance</span><span>${r.targetDist.toFixed(4)}</span></div>
      <div class="calc-row"><span>Risk/Reward</span><span class="${rrOk ? 'text-green' : 'text-red'}">${r.rr.toFixed(2)}:1 ${rrOk ? '✓' : '✗'}</span></div>
      <div class="calc-row"><span>Potential Loss</span><span class="text-red">${formatCurrency(r.potentialLoss, cur)}</span></div>
      <div class="calc-row"><span>Potential Profit</span><span class="text-green">+${formatCurrency(r.potentialProfit, cur)}</span></div>
    </div>
    <div class="mt8">${rrOk ? '<div class="alert alert-green"><span>✓ Risk Accepted — RR meets minimum requirement</span></div>' : '<div class="alert alert-red"><span>✗ RR below minimum (' + s.minRR + ':1 required)</span></div>'}</div>
  `;
}

// ============================================================
// TRADE LIFECYCLE
// ============================================================
function startTrade() {
  const ct = canTrade();
  if (!ct.allowed) { toast('Cannot start trade: ' + ct.reasons[0], 'error'); return; }
  const r = calcRiskValues();
  const riskPL = r ? r.riskAmount : (state.settings.balance * state.settings.risk / 100);

  state.activeTrade = {
    direction: state.analysis.direction,
    entry: state.analysis.entry,
    sl: state.analysis.sl,
    tp: state.analysis.tp,
    riskPct: state.settings.risk,
    riskAmount: riskPL,
    rr: r ? r.rr : 0,
    entryModel: state.analysis.entryModel,
    startTime: new Date().toISOString(),
  };
  saveState();
  toast('Trade started. Follow your plan.', 'info');
  renderAll();
  navigate('today');
}

// ============================================================
// CLOSE TRADE MODAL
// ============================================================
let _pendingCloseResult = null;
function openCloseTrade(result) {
  if (!state.activeTrade) return;
  _pendingCloseResult = result;
  const t = state.activeTrade;
  const r = calcRiskValues();
  const defaultR = result === 'WIN' ? (r ? parseFloat(r.rr.toFixed(2)) : 1) : result === 'LOSS' ? -1 : 0;
  document.getElementById('close-trade-title').textContent = 'Close Trade — ' + result;
  const inp = document.getElementById('close-trade-r');
  inp.value = defaultR;
  const help = document.getElementById('close-trade-help');
  if (result === 'BREAKEVEN') { help.textContent = 'Enter 0 for breakeven, or a small positive/negative for slight deviation.'; }
  else if (result === 'WIN') { help.textContent = 'Enter the actual R multiple achieved (e.g. 2.0 = full TP hit, 1.0 = partial).'; }
  else { help.textContent = 'Enter a negative R value (e.g. -1.0 = full SL hit, -0.5 = partial loss).'; }
  updateCloseTradePrev();
  openModal('modal-close-trade');
  inp.oninput = updateCloseTradePrev;
}
function updateCloseTradePrev() {
  const t = state.activeTrade;
  if (!t) return;
  const inp = document.getElementById('close-trade-r');
  const prev = document.getElementById('close-trade-preview');
  const rVal = parseFloat(inp.value);
  if (isNaN(rVal)) { prev.style.display = 'none'; return; }
  const pl = rVal * t.riskAmount;
  prev.style.display = 'flex';
  prev.innerHTML = `
    <div class="calc-row"><span>Result R</span><span class="${rVal > 0 ? 'text-green' : rVal < 0 ? 'text-red' : ''}">${rVal > 0 ? '+' : ''}${rVal}R</span></div>
    <div class="calc-row"><span>P/L</span><span class="${pl > 0 ? 'text-green' : pl < 0 ? 'text-red' : ''}">${pl >= 0 ? '+' : ''}${formatCurrency(pl, state.settings.currency)}</span></div>
    <div class="calc-row"><span>Risk Amount</span><span>${formatCurrency(t.riskAmount, state.settings.currency)}</span></div>
  `;
}
function confirmCloseTrade() {
  if (!state.activeTrade || !_pendingCloseResult) return;
  const rVal = parseFloat(document.getElementById('close-trade-r').value);
  if (isNaN(rVal)) { toast('Enter a valid R value.', 'error'); return; }
  closeModal('modal-close-trade');
  closeTrade(_pendingCloseResult, rVal);
  _pendingCloseResult = null;
}

function closeTrade(result, explicitR) {
  if (!state.activeTrade) return;
  const t = state.activeTrade;
  const r = calcRiskValues();
  const s = state.settings;

  let resultR = (explicitR !== undefined) ? explicitR : (result === 'WIN' ? (r ? r.rr : 1) : result === 'LOSS' ? -1 : 0);
  let resultPL = resultR * t.riskAmount;

  const trade = {
    id: Date.now().toString(),
    date: state.currentDay,
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    direction: t.direction, entry: t.entry, sl: t.sl, tp: t.tp,
    riskPct: t.riskPct, riskAmount: t.riskAmount, rr: (r ? r.rr : t.rr).toFixed(2),
    result, resultR: result === 'BREAKEVEN' ? 0 : parseFloat(resultR.toFixed(2)),
    resultPL: parseFloat(resultPL.toFixed(2)),
    setup: state.analysis.entryModel,
    emotion: state.preparation.emotion,
    violation: 0, notes: '',
    session: 'Other', good: '', bad: '', change: '',
    reviewAnswers: {},
  };

  state.trades.push(trade);
  state.activeTrade = null;

  // Check if any hard stop is now triggered (without latching killSwitch manually)
  const stops = getStopReasons();
  if (stops.length) {
    toast('TRADING TERMINATED: ' + stops[0], 'error');
  } else {
    toast('Trade recorded: ' + result, result === 'WIN' ? 'success' : result === 'LOSS' ? 'error' : 'info');
  }

  saveState();
  renderAll();
  navigate('today');
}

// ============================================================
// CHECKLIST RENDER
// ============================================================
function renderPretradeChecklist() {
  const el = document.getElementById('pretrade-checklist');
  const appEl = document.getElementById('trade-approval-result');
  const startBtn = document.getElementById('start-trade-btn');
  if (!el) return;

  const stopped = isStopped();
  const stopReasons = getStopReasons();

  if (stopped) {
    if (startBtn) startBtn.classList.add('hidden');
    el.innerHTML = '';
    if (appEl) appEl.innerHTML = `
      <div class="approval-box approval-terminated">
        <div class="approval-big text-red">TRADING TERMINATED</div>
        <div class="approval-reason" style="color:var(--red)">${stopReasons.join('<br>')}</div>
      </div>`;
    return;
  }

  if (state.activeTrade) {
    if (startBtn) startBtn.classList.add('hidden');
    el.innerHTML = '<div class="alert alert-blue"><span>A trade is currently active. Close it on the Today page.</span></div>';
    if (appEl) appEl.innerHTML = '';
    return;
  }

  const checks = [
    { label: 'Preparation completed', pass: !!state.preparation.emotion },
    { label: 'Rules acknowledged', pass: state.preparation.rulesAccepted },
    { label: 'Bias selected', pass: !!state.analysis.biasDir },
    { label: 'Liquidity identified', pass: state.analysis.liquidity && state.analysis.liquidity.length > 0 },
    { label: 'Liquidity sweep confirmed', pass: state.analysis.sweep },
    { label: 'Market Structure Shift confirmed', pass: state.analysis.mss },
    { label: 'Entry model selected', pass: !!state.analysis.entryModel },
    { label: 'Direction set', pass: !!state.analysis.direction },
    { label: 'Entry price defined', pass: !!state.analysis.entry },
    { label: 'Stop loss defined', pass: !!state.analysis.sl },
    { label: 'Take profit defined', pass: !!state.analysis.tp },
    { label: 'Daily loss limit available', pass: getDailyPL() > -(state.settings.balance * state.settings.dailyLoss / 100) },
    { label: 'Trade count available', pass: getDailyTrades().length < state.settings.maxTrades },
    { label: 'Consecutive loss limit OK', pass: getConsecLosses() < state.settings.maxConsecLoss },
    { label: 'Daily target not yet reached', pass: getDailyR() < state.settings.target },
  ];

  const risk = calcRiskValues();
  if (risk) {
    checks.push({ label: 'RR valid (' + risk.rr.toFixed(2) + ':1 ≥ ' + state.settings.minRR + ':1)', pass: risk.rr >= state.settings.minRR });
  } else {
    checks.push({ label: 'Risk/Reward calculable', pass: false });
  }

  el.innerHTML = checks.map(c => `
    <div class="check-row ${c.pass ? 'pass' : 'fail'}">
      <span class="check-icon">${c.pass ? '✓' : '✗'}</span>
      <span>${c.label}</span>
    </div>
  `).join('');

  const ct = canTrade();
  if (appEl) {
    appEl.innerHTML = ct.allowed
      ? `<div class="approval-box approval-approved">
          <div class="approval-big text-green">TRADE APPROVED</div>
          <div class="approval-reason" style="color:var(--green)">All conditions met — execute according to your plan</div>
         </div>`
      : `<div class="approval-box approval-denied">
          <div class="approval-big text-red">NO TRADE</div>
          <div class="approval-reason" style="color:var(--red)">${ct.reasons.join('<br>')}</div>
         </div>`;
  }
  if (startBtn) {
    ct.allowed ? startBtn.classList.remove('hidden') : startBtn.classList.add('hidden');
  }
}

// ============================================================
// TODAY PAGE
// ============================================================
function renderToday() {
  const s = state.settings;
  const todayTrades = getDailyTrades();
  const dailyR = getDailyR();
  const dailyPL = getDailyPL();
  const status = getTradingStatus();
  const tz = s.timezone || 'UTC';

  // Date/time
  const now = new Date();
  document.getElementById('today-date').textContent = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const _tb = document.getElementById('today-balance');
  if (_tb) {
    const _v = formatCurrency(s.balance, s.currency);
    _tb.dataset.originalText = _v;
    _tb.textContent = (window.isPrivacyOn && window.isPrivacyOn()) ? '••••••' : _v;
    _tb.classList.add('balance-value');
  }
  try { window.refreshPrivacy?.(); } catch (_) {}

  // Mission
  const missionEl = document.getElementById('mission-text');
  if (missionEl) {
    const missions = {
      PREPARATION: 'Complete your preparation. Record your mental state and acknowledge the rules.',
      ANALYSIS: 'Complete your market analysis before considering a trade.',
      WAITING: 'Your setup is incomplete. WAIT — no trade until all conditions are met.',
      TRADE_APPROVED: 'Trade approved. Execute only according to your plan.',
      TRADE_ACTIVE: 'Trade in progress. Stay disciplined. Do not move your stop.',
      TERMINATED: 'Trading terminated. Close the charts. Review your session.',
    };
    missionEl.textContent = missions[status] || 'Follow your plan.';
  }

  // Workflow bar
  const wfEl = document.getElementById('workflow-bar');
  if (wfEl) {
    const prepDone = state.preparation.rulesAccepted;
    const analysisDone = state.analysis.biasDir && state.analysis.sweep && state.analysis.mss && state.analysis.entryModel;
    const checkDone = canTrade().allowed || status === 'TRADE_ACTIVE' || status === 'TERMINATED';
    const tradeDone = todayTrades.length > 0 || status === 'TRADE_ACTIVE';
    const reviewDone = status === 'TERMINATED';

    const wfSteps = [
      { label: 'PREPARE', state: prepDone ? 'done' : (status === 'PREPARATION' ? 'active' : 'idle') },
      { label: 'ANALYZE', state: analysisDone ? 'done' : (prepDone ? 'active' : 'idle') },
      { label: 'CHECK', state: checkDone ? 'done' : (analysisDone ? 'active' : 'idle') },
      { label: 'EXECUTE', state: status === 'TRADE_ACTIVE' ? 'active' : (tradeDone ? 'done' : 'idle') },
      { label: 'REVIEW', state: reviewDone ? 'active' : 'idle' },
    ];

    wfEl.innerHTML = wfSteps.map((step, i) => `
      <div class="wf-step">
        <div class="wf-node wf-${step.state}">${step.state === 'done' ? '✓' : step.state === 'active' ? '▶' : '○'} ${step.label}</div>
        ${i < wfSteps.length - 1 ? '<span class="wf-arrow">→</span>' : ''}
      </div>
    `).join('');
  }

  // Metrics
  const metricsEl = document.getElementById('today-metrics');
  if (metricsEl) {
    const rColor = dailyR > 0 ? 'metric-pos' : dailyR < 0 ? 'metric-neg' : 'metric-neu';
    const plColor = dailyPL > 0 ? 'metric-pos' : dailyPL < 0 ? 'metric-neg' : 'metric-neu';
    const consecL = getConsecLosses();
    metricsEl.innerHTML = `
      <div class="metric"><div class="metric-label">Daily R</div><div class="metric-value ${rColor}">${dailyR > 0 ? '+' : ''}${dailyR.toFixed(2)}R</div></div>
      <div class="metric"><div class="metric-label">Daily P/L</div><div class="metric-value ${plColor}">${dailyPL >= 0 ? '+' : ''}${formatCurrency(dailyPL, s.currency)}</div></div>
      <div class="metric"><div class="metric-label">Trades Today</div><div class="metric-value">${todayTrades.length} / ${s.maxTrades}</div></div>
      <div class="metric"><div class="metric-label">Consec. Losses</div><div class="metric-value ${consecL >= s.maxConsecLoss ? 'metric-neg' : consecL > 0 ? 'metric-neu' : ''}">${consecL} / ${s.maxConsecLoss}</div></div>
      <div class="metric"><div class="metric-label">Risk Per Trade</div><div class="metric-value">${s.risk}%</div></div>
    `;
  }

  // Rules
  const rulesEl = document.getElementById('today-rules');
  if (rulesEl) {
    rulesEl.innerHTML = `
      <div class="flex-between"><span class="text-muted">Risk per trade</span><span>${s.risk}%</span></div>
      <div class="flex-between"><span class="text-muted">Daily max loss</span><span>${s.dailyLoss}%</span></div>
      <div class="flex-between"><span class="text-muted">Max trades</span><span>${s.maxTrades}</span></div>
      <div class="flex-between"><span class="text-muted">Max consec. losses</span><span>${s.maxConsecLoss}</span></div>
      <div class="flex-between"><span class="text-muted">Daily target</span><span>+${s.target}R</span></div>
      <div class="flex-between"><span class="text-muted">Min RR</span><span>1:${s.minRR}</span></div>
    `;
  }

  // Today trades list
  const tlEl = document.getElementById('today-trades-list');
  if (tlEl) {
    if (!todayTrades.length) {
      tlEl.innerHTML = '<div class="text-muted text-xs" style="padding:8px 0">No trades recorded today.</div>';
    } else {
      tlEl.innerHTML = todayTrades.map(t => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
          <div>
            <span class="pill ${t.result === 'WIN' ? 'pill-green' : t.result === 'LOSS' ? 'pill-red' : 'pill-amber'}">${t.result}</span>
            <span style="margin-left:8px;color:var(--text2)">${t.direction} ${t.setup || ''}</span>
          </div>
          <span class="${t.resultR > 0 ? 'text-green' : t.resultR < 0 ? 'text-red' : 'text-muted'} font-mono">
            ${t.resultR > 0 ? '+' : ''}${t.resultR}R
          </span>
        </div>
      `).join('');
    }
  }

  // Active trade panel
  const atPanel = document.getElementById('active-trade-panel');
  const termPanel = document.getElementById('terminated-panel');

  if (state.activeTrade) {
    atPanel.classList.remove('hidden');
    termPanel.classList.add('hidden');
    const at = state.activeTrade;
    const atMetrics = document.getElementById('active-trade-metrics');
    if (atMetrics) {
      atMetrics.innerHTML = `
        <div class="metric"><div class="metric-label">Direction</div><div class="metric-value" style="font-size:16px">${at.direction}</div></div>
        <div class="metric"><div class="metric-label">Entry</div><div class="metric-value" style="font-size:16px">${at.entry}</div></div>
        <div class="metric"><div class="metric-label">Stop Loss</div><div class="metric-value" style="font-size:16px;color:var(--red)">${at.sl}</div></div>
        <div class="metric"><div class="metric-label">Take Profit</div><div class="metric-value" style="font-size:16px;color:var(--green)">${at.tp}</div></div>
      `;
    }
  } else {
    atPanel.classList.add('hidden');
  }

  if (status === 'TERMINATED') {
    termPanel.classList.remove('hidden');
    const reasons = getStopReasons();
    const reasonEl = document.getElementById('terminated-reason');
    if (reasonEl) reasonEl.textContent = 'Reason: ' + reasons[0];
    renderDailyReviewPanel();
  } else {
    termPanel.classList.add('hidden');
  }

  // Update global status badge
  updateStatusBadge(status);
}

function updateStatusBadge(status) {
  const badge = document.getElementById('topbar-status-badge');
  const dot = document.getElementById('nav-status-dot');
  if (!badge) return;

  const map = {
    PREPARATION: ['PREPARATION', 'badge-prep', ''],
    ANALYSIS: ['ANALYSIS', 'badge-prep', ''],
    WAITING: ['WAITING', 'badge-waiting', 'status-amber'],
    TRADE_APPROVED: ['TRADE APPROVED', 'badge-approved', 'status-green'],
    TRADE_ACTIVE: ['TRADE ACTIVE', 'badge-active', 'status-green'],
    TERMINATED: ['TERMINATED', 'badge-terminated', 'status-red'],
  };
  const [label, cls, dotCls] = map[status] || ['—', 'badge-prep', ''];
  badge.textContent = label;
  badge.className = 'status-badge ' + cls;
  if (dot) dot.className = 'nav-status ' + dotCls;
}

// ============================================================
// PREPARE PAGE
// ============================================================
function renderPrepare() {
  // Emotion grid
  const emotions = ['Calm', 'Focused', 'Patient', 'Confident', 'Tired', 'Distracted', 'Frustrated', 'Angry', 'Greedy', 'Fearful'];
  const grid = document.getElementById('emotion-grid');
  if (grid) {
    grid.innerHTML = emotions.map(e => `
      <button class="emotion-pill ${state.preparation.emotion === e ? 'selected-' + e.toLowerCase() : ''}"
        onclick="selectEmotion('${e}')">${e}</button>
    `).join('');
  }

  // Emotion warning
  const warn = document.getElementById('emotion-warning');
  if (warn) {
    const bad = ['Frustrated', 'Angry', 'Greedy', 'Fearful'];
    const neutral = ['Tired', 'Distracted'];
    const em = state.preparation.emotion;
    if (em && bad.includes(em)) {
      warn.className = 'alert alert-red mt12';
      warn.innerHTML = '⚠ Emotional Warning: ' + em + ' state may increase impulsive decisions. Continue only if you can follow your rules.';
      warn.style.display = 'flex';
    } else if (em && neutral.includes(em)) {
      warn.className = 'alert alert-amber mt12';
      warn.innerHTML = '⚠ Caution: ' + em + ' state. Apply extra discipline today.';
      warn.style.display = 'flex';
    } else {
      warn.style.display = 'none';
    }
  }

  // Restore text fields
  const focusEl = document.getElementById('prep-focus');
  const newsEl = document.getElementById('prep-news');
  const marketsEl = document.getElementById('prep-markets');
  if (focusEl) focusEl.value = state.preparation.focus || '';
  if (newsEl) newsEl.value = state.preparation.news || '';
  if (marketsEl) marketsEl.value = state.preparation.markets || '';

  // Rules contract
  const rc = document.getElementById('rules-contract');
  const s = state.settings;
  if (rc) {
    rc.innerHTML = `
      <div style="display:grid;gap:6px;font-size:13px">
        <div class="flex-between"><span class="text-muted">Risk per trade</span><span>${s.risk}%</span></div>
        <div class="flex-between"><span class="text-muted">Daily maximum loss</span><span>${s.dailyLoss}%</span></div>
        <div class="flex-between"><span class="text-muted">Maximum trades per day</span><span>${s.maxTrades}</span></div>
        <div class="flex-between"><span class="text-muted">Maximum consecutive losses</span><span>${s.maxConsecLoss}</span></div>
        <div class="flex-between"><span class="text-muted">Daily target</span><span>+${s.target}R</span></div>
        <div class="flex-between"><span class="text-muted">Minimum RR</span><span>1:${s.minRR}</span></div>
      </div>
    `;
  }

  // Accept button
  const btn = document.getElementById('accept-btn');
  const acc = document.getElementById('accept-status');
  if (btn && acc) {
    if (state.preparation.rulesAccepted) {
      btn.className = 'btn btn-full';
      btn.textContent = '✓ Rules Accepted';
      btn.disabled = true;
      acc.className = 'alert alert-green mt8';
      acc.textContent = 'You have accepted today\'s rules. Trade with discipline.';
      acc.style.display = 'flex';
    } else {
      btn.className = 'btn btn-primary btn-full';
      btn.textContent = 'I Accept Today\'s Rules';
      btn.disabled = false;
      acc.style.display = 'none';
    }
  }
}

function selectEmotion(em) {
  state.preparation.emotion = em;
  saveState(); renderPrepare();
}

function acceptRules() {
  if (!state.preparation.emotion) { toast('Select your mental state first.', 'error'); return; }
  // Save prep notes
  state.preparation.focus = document.getElementById('prep-focus')?.value || '';
  state.preparation.news = document.getElementById('prep-news')?.value || '';
  state.preparation.markets = document.getElementById('prep-markets')?.value || '';
  state.preparation.rulesAccepted = true;
  saveState(); renderPrepare(); renderToday();
  toast('Rules accepted. Trade with discipline.', 'success');
}

// ============================================================
// SETUP PAGE
// ============================================================
function renderSetup() {
  // Bias direction
  renderRadioGroup('bias-dir', ['Bullish', 'Bearish', 'Neutral'], state.analysis.biasDir, v => { state.analysis.biasDir = v; saveState(); });
  renderRadioGroup('bias-htf', ['Bullish', 'Bearish', 'Neutral'], state.analysis.biasHTF, v => { state.analysis.biasHTF = v; saveState(); renderBiasAlignment(); });
  renderRadioGroup('bias-etf', ['Bullish', 'Bearish', 'Neutral'], state.analysis.biasETF, v => { state.analysis.biasETF = v; saveState(); renderBiasAlignment(); });

  renderBiasAlignment();

  // Notes
  const bn = document.getElementById('bias-notes');
  if (bn) bn.value = state.analysis.biasNotes || '';

  // Liquidity
  const liqItems = ['Previous High', 'Previous Low', 'Equal Highs', 'Equal Lows', 'Session High', 'Session Low', 'Other'];
  const liqEl = document.getElementById('liquidity-checks');
  if (liqEl) {
    liqEl.innerHTML = liqItems.map(item => `
      <label class="check-item ${(state.analysis.liquidity||[]).includes(item) ? 'selected' : ''}" onclick="toggleLiquidity('${item}')">
        <div class="check-box"><span class="check-mark">✓</span></div>
        <span style="font-size:13px">${item}</span>
      </label>
    `).join('');
  }
  const ln = document.getElementById('liquidity-notes');
  if (ln) ln.value = state.analysis.liquidityNotes || '';

  // Sweep
  const sweepEl = document.getElementById('sweep-check');
  if (sweepEl) sweepEl.innerHTML = renderCheckbox('Liquidity sweep confirmed', state.analysis.sweep, "toggleCheck('sweep')");
  const sn = document.getElementById('sweep-notes');
  if (sn) sn.value = state.analysis.sweepNotes || '';

  // MSS
  const mssEl = document.getElementById('mss-check');
  if (mssEl) mssEl.innerHTML = renderCheckbox('Market structure shift confirmed', state.analysis.mss, "toggleCheck('mss')");
  const mn = document.getElementById('mss-notes');
  if (mn) mn.value = state.analysis.mssNotes || '';

  // Entry model
  renderRadioGroup('entry-model-group', ['FVG', 'Order Block', 'OTE', 'Other'], state.analysis.entryModel, v => { state.analysis.entryModel = v; saveState(); });

  // Trade direction
  renderRadioGroup('trade-direction', ['LONG', 'SHORT'], state.analysis.direction, v => { state.analysis.direction = v; saveState(); renderRiskCalc(); });

  // Values
  const entryEl = document.getElementById('trade-entry');
  const slEl = document.getElementById('trade-sl');
  const tpEl = document.getElementById('trade-tp');
  const ptEl = document.getElementById('trade-ptval');
  if (entryEl) entryEl.value = state.analysis.entry || '';
  if (slEl) slEl.value = state.analysis.sl || '';
  if (tpEl) tpEl.value = state.analysis.tp || '';
  if (ptEl) ptEl.value = state.analysis.ptval || state.settings.ptval || '';

  renderRiskCalc();
}

function renderBiasAlignment() {
  const el = document.getElementById('bias-alignment');
  if (!el) return;
  const htf = state.analysis.biasHTF, etf = state.analysis.biasETF;
  if (!htf || !etf) { el.innerHTML = ''; return; }
  if (htf === etf) {
    el.innerHTML = '<div class="alert alert-green"><span>ALIGNMENT — Higher and execution timeframes agree: ' + htf + '</span></div>';
  } else if ((htf === 'Bullish' && etf === 'Bearish') || (htf === 'Bearish' && etf === 'Bullish')) {
    el.innerHTML = '<div class="alert alert-red"><span>CONFLICT — Timeframes disagree. High-risk environment. Consider waiting.</span></div>';
  } else {
    el.innerHTML = '<div class="alert alert-amber"><span>UNCONFIRMED — Mixed signals. Proceed with caution.</span></div>';
  }
}

function renderCheckbox(label, checked, onclick) {
  return `<label class="check-item ${checked ? 'selected' : ''}" onclick="${onclick}">
    <div class="check-box"><span class="check-mark">✓</span></div>
    <span style="font-size:13px">${label}</span>
  </label>`;
}

function toggleLiquidity(item) {
  if (!state.analysis.liquidity) state.analysis.liquidity = [];
  const idx = state.analysis.liquidity.indexOf(item);
  if (idx === -1) state.analysis.liquidity.push(item);
  else state.analysis.liquidity.splice(idx, 1);
  saveState(); renderSetup();
}

function toggleCheck(field) {
  if (field === 'sweep') { state.analysis.sweep = !state.analysis.sweep; }
  if (field === 'mss') { state.analysis.mss = !state.analysis.mss; }
  saveState(); renderSetup();
}

function saveSetup() {
  // Save all text areas
  state.analysis.biasNotes = document.getElementById('bias-notes')?.value || '';
  state.analysis.liquidityNotes = document.getElementById('liquidity-notes')?.value || '';
  state.analysis.sweepNotes = document.getElementById('sweep-notes')?.value || '';
  state.analysis.mssNotes = document.getElementById('mss-notes')?.value || '';
  state.analysis.entry = document.getElementById('trade-entry')?.value || '';
  state.analysis.sl = document.getElementById('trade-sl')?.value || '';
  state.analysis.tp = document.getElementById('trade-tp')?.value || '';
  state.analysis.ptval = document.getElementById('trade-ptval')?.value || '';
  saveState();
  toast('Analysis saved.', 'success');
  renderAll();
}

const _radioHandlers = {};
function renderRadioGroup(id, options, selected, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  _radioHandlers[id] = onChange;
  el.innerHTML = options.map(opt => `
    <button class="radio-btn ${selected === opt ? 'selected' : ''}" data-val="${opt}" onclick="radioSelect('${id}', '${opt.replace(/'/g, "\\'")}', this)">
      ${opt}
    </button>
  `).join('');
}
function radioSelect(id, val, btn) {
  const el = document.getElementById(id);
  if (el) el.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  if (_radioHandlers[id]) _radioHandlers[id](val);
}

// ============================================================
// JOURNAL
// ============================================================
function renderJournal() {
  const el = document.getElementById('journal-content');
  if (!el) return;

  const search = (document.getElementById('journal-search')?.value || '').toLowerCase().trim();
  const filterResult = document.getElementById('journal-filter-result')?.value || '';
  const filterDir = document.getElementById('journal-filter-dir')?.value || '';
  const filterSetup = document.getElementById('journal-filter-setup')?.value || '';

  // Populate setup filter options from actual data
  const setupSel = document.getElementById('journal-filter-setup');
  if (setupSel) {
    const setups = [...new Set((state.trades || []).map(t => (t.setup || '').trim()).filter(Boolean))].sort();
    const current = setupSel.value;
    setupSel.innerHTML = '<option value="">All Setups</option>' + setups.map(s =>
      `<option value="${String(s).replace(/"/g,'&quot;')}">${s}</option>`
    ).join('');
    if (current && setups.includes(current)) setupSel.value = current;
  }

  let trades = [...(state.trades || [])].sort((a, b) => {
    const da = String(a.date || '');
    const db = String(b.date || '');
    if (da !== db) return db.localeCompare(da);
    return Number(b.id) - Number(a.id);
  });

  if (search) {
    trades = trades.filter(t => {
      const hay = [
        t.notes, t.setup, t.emotion, t.direction, t.result,
        t.good, t.bad, t.change, t.session, t.date, t.time
      ].map(x => String(x || '').toLowerCase()).join(' ');
      return hay.includes(search);
    });
  }
  if (filterResult) trades = trades.filter(t => String(t.result || '').toUpperCase() === filterResult.toUpperCase());
  if (filterDir) trades = trades.filter(t => String(t.direction || '').toUpperCase() === filterDir.toUpperCase());
  if (filterSetup) trades = trades.filter(t => String(t.setup || '') === filterSetup);

  if (!trades.length) {
    const hasAny = (state.trades || []).length > 0;
    el.innerHTML = `<div class="empty">
      <div class="empty-icon">📋</div>
      <h3>${hasAny ? 'No trades match your filters' : 'No trades recorded yet'}</h3>
      <p>${hasAny ? 'Try clearing filters or adjusting your search.' : 'Your trading history will appear here.'}</p>
      ${hasAny ? '<button class="btn btn-sm mt8" onclick="clearJournalFilters()">Clear filters</button>' : ''}
    </div>`;
    return;
  }

  const cur = state.settings?.currency || 'USD';
  const fmtR = (r) => {
    const n = Number(r) || 0;
    return (n > 0 ? '+' : '') + n + 'R';
  };
  const fmtPL = (pl) => {
    const n = Number(pl) || 0;
    return (n >= 0 ? '+' : '') + formatCurrency(n, cur);
  };
  const resultClass = (r) => r === 'WIN' ? 'td-win' : r === 'LOSS' ? 'td-loss' : 'td-be';
  const pillDir = (d) => d === 'LONG' ? 'pill-green' : 'pill-red';

  const cards = trades.map(t => {
    const id = String(t.id).replace(/'/g, "\\'");
    return `<div class="journal-card">
      <div class="journal-card-top">
        <span class="font-mono" style="color:var(--text2);font-size:12px">${t.date || '—'}${t.time ? ' · ' + t.time : ''}</span>
        <span class="pill ${pillDir(t.direction)}">${t.direction || '—'}</span>
        <span class="${resultClass(t.result)}" style="font-weight:700">${t.result || '—'}</span>
        <span class="font-mono ${resultClass(t.result)}" style="margin-left:auto">${fmtR(t.resultR)}</span>
      </div>
      <div class="journal-card-meta">
        <div><strong>P/L</strong><span class="font-mono ${resultClass(t.result)}">${fmtPL(t.resultPL)}</span></div>
        <div><strong>Setup</strong>${t.setup || '—'}</div>
        <div><strong>Emotion</strong>${t.emotion || '—'}</div>
        <div><strong>Session</strong>${t.session || '—'}</div>
      </div>
      ${t.notes ? `<div class="journal-card-notes">${String(t.notes).replace(/</g,'&lt;')}</div>` : ''}
      <div class="journal-card-actions">
        <button class="btn btn-sm" onclick="viewTrade('${id}')">View</button>
        <button class="btn btn-sm" onclick="editTrade('${id}')">Edit</button>
        <button class="btn btn-sm" onclick="duplicateTrade('${id}')">Copy</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTrade('${id}')">Delete</button>
      </div>
    </div>`;
  }).join('');

  const rows = trades.map(t => {
    const id = String(t.id).replace(/'/g, "\\'");
    return `<tr>
      <td class="font-mono" style="color:var(--text2)">${t.date || '—'}</td>
      <td><span class="pill ${pillDir(t.direction)}">${t.direction || '—'}</span></td>
      <td style="color:var(--text2)">${t.setup || '—'}</td>
      <td><span class="${resultClass(t.result)}">${t.result || '—'}</span></td>
      <td class="font-mono ${resultClass(t.result)}">${fmtR(t.resultR)}</td>
      <td class="font-mono ${resultClass(t.result)}">${fmtPL(t.resultPL)}</td>
      <td style="color:var(--text2)">${t.emotion || '—'}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${t.notes || '—'}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="viewTrade('${id}')">View</button>
          <button class="btn btn-sm" onclick="editTrade('${id}')">Edit</button>
          <button class="btn btn-sm" onclick="duplicateTrade('${id}')">Copy</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTrade('${id}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="journal-count">${trades.length} trade${trades.length === 1 ? '' : 's'}</div>
    <div class="journal-cards">${cards}</div>
    <div class="journal-table-desktop tbl-wrap"><table>
      <thead><tr>
        <th>Date</th><th>Dir</th><th>Setup</th><th>Result</th><th>R</th><th>P/L</th><th>Emotion</th><th>Notes</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function clearJournalFilters() {
  const s = document.getElementById('journal-search');
  const r = document.getElementById('journal-filter-result');
  const d = document.getElementById('journal-filter-dir');
  const u = document.getElementById('journal-filter-setup');
  if (s) s.value = '';
  if (r) r.value = '';
  if (d) d.value = '';
  if (u) u.value = '';
  renderJournal();
}

function openAddTrade() {
  state.tradeEditId = null;
  state.reviewAnswers = {};
  state.screenshotData = null;
  document.getElementById('modal-trade-title').textContent = 'Add Trade';
  // Defaults
  const now = new Date();
  document.getElementById('t-date').value = state.currentDay || now.toISOString().split('T')[0];
  document.getElementById('t-time').value = now.toTimeString().slice(0,5);
  document.getElementById('t-direction').value = state.analysis.direction || 'LONG';
  document.getElementById('t-entry').value = state.analysis.entry || '';
  document.getElementById('t-sl').value = state.analysis.sl || '';
  document.getElementById('t-tp').value = state.analysis.tp || '';
  document.getElementById('t-result').value = 'WIN';
  document.getElementById('t-result-r').value = '';
  document.getElementById('t-setup').value = state.analysis.entryModel || 'FVG';
  document.getElementById('t-risk').value = state.settings.risk;
  document.getElementById('t-emotion').value = state.preparation.emotion || 'Calm';
  document.getElementById('t-violation').value = '0';
  document.getElementById('t-notes').value = '';
  document.getElementById('t-good').value = '';
  document.getElementById('t-bad').value = '';
  document.getElementById('t-change').value = '';
  document.getElementById('t-screenshot-preview').innerHTML = '';
  renderReviewChecks();
  openModal('modal-add-trade');
}

function editTrade(id) {
  const trade = state.trades.find(t => t.id === id);
  if (!trade) return;
  state.tradeEditId = id;
  state.reviewAnswers = trade.reviewAnswers || {};
  state.screenshotData = trade.screenshot || null;
  document.getElementById('modal-trade-title').textContent = 'Edit Trade';
  document.getElementById('t-date').value = trade.date || '';
  document.getElementById('t-time').value = trade.time || '';
  document.getElementById('t-direction').value = trade.direction || 'LONG';
  document.getElementById('t-entry').value = trade.entry || '';
  document.getElementById('t-sl').value = trade.sl || '';
  document.getElementById('t-tp').value = trade.tp || '';
  document.getElementById('t-result').value = trade.result || 'WIN';
  document.getElementById('t-result-r').value = trade.resultR || '';
  document.getElementById('t-setup').value = trade.setup || 'FVG';
  document.getElementById('t-risk').value = trade.riskPct || state.settings.risk;
  document.getElementById('t-emotion').value = trade.emotion || 'Calm';
  document.getElementById('t-violation').value = trade.violation ? '1' : '0';
  document.getElementById('t-notes').value = trade.notes || '';
  document.getElementById('t-good').value = trade.good || '';
  document.getElementById('t-bad').value = trade.bad || '';
  document.getElementById('t-change').value = trade.change || '';
  document.getElementById('t-screenshot-preview').innerHTML = trade.screenshot ? `<img src="${xeScreenshotSrc(trade.screenshot)}" style="max-width:100%;max-height:120px;border-radius:4px">` : '';
  renderReviewChecks();
  openModal('modal-add-trade');
}

function viewTrade(id) {
  const t = state.trades.find(t => t.id === id);
  if (!t) return;
  const s = state.settings;
  document.getElementById('trade-detail-content').innerHTML = `
    <div style="display:grid;gap:10px;font-size:13px">
      <div class="flex-between"><span class="text-muted">Date / Time</span><span>${t.date} ${t.time}</span></div>
      <div class="flex-between"><span class="text-muted">Direction</span><span class="pill ${t.direction==='LONG'?'pill-green':'pill-red'}">${t.direction}</span></div>
      <div class="flex-between"><span class="text-muted">Setup</span><span>${t.setup}</span></div>
      <div class="flex-between"><span class="text-muted">Entry / SL / TP</span><span>${t.entry} / ${t.sl} / ${t.tp}</span></div>
      <div class="flex-between"><span class="text-muted">RR</span><span>${t.rr}:1</span></div>
      <div class="flex-between"><span class="text-muted">Risk</span><span>${t.riskPct}% (${formatCurrency(t.riskAmount||0, s.currency)})</span></div>
      <div class="flex-between"><span class="text-muted">Result</span><span class="${t.result==='WIN'?'td-win':t.result==='LOSS'?'td-loss':'td-be'}">${t.result}</span></div>
      <div class="flex-between"><span class="text-muted">Result R / P/L</span><span class="${t.resultR>0?'td-win':t.resultR<0?'td-loss':'td-be'}">${t.resultR>0?'+':''}${t.resultR}R / ${t.resultPL>=0?'+':''}${formatCurrency(t.resultPL,s.currency)}</span></div>
      <div class="flex-between"><span class="text-muted">Emotion</span><span>${t.emotion}</span></div>
      <div class="flex-between"><span class="text-muted">Rule Violation</span><span class="${t.violation?'text-red':''}">${t.violation ? 'YES' : 'No'}</span></div>
      ${t.notes ? `<div><span class="text-muted">Notes</span><div style="margin-top:4px">${t.notes}</div></div>` : ''}
      ${t.good ? `<div><span class="text-muted">What went well</span><div style="margin-top:4px">${t.good}</div></div>` : ''}
      ${t.bad ? `<div><span class="text-muted">What went wrong</span><div style="margin-top:4px">${t.bad}</div></div>` : ''}
      ${t.change ? `<div><span class="text-muted">Will change</span><div style="margin-top:4px">${t.change}</div></div>` : ''}
      ${t.screenshot ? `<div><span class="text-muted">Screenshot</span><div style="margin-top:6px"><img src="${xeScreenshotSrc(t.screenshot)}" style="max-width:100%;border-radius:6px" onclick="this.style.maxWidth=this.style.maxWidth==='100%'?'none':'100%'"></div></div>` : ''}
    </div>
    <div class="btn-group mt16">
      <button class="btn btn-sm" onclick="editTrade('${t.id}');closeModal('modal-trade-detail')">Edit</button>
      <button class="btn btn-sm" onclick="duplicateTrade('${t.id}');closeModal('modal-trade-detail')">Duplicate</button>
      <button class="btn btn-sm btn-danger" onclick="deleteTrade('${t.id}');closeModal('modal-trade-detail')">Delete</button>
    </div>
  `;
  openModal('modal-trade-detail');
}

const REVIEW_QUESTIONS = [
  { key: 'followedSetup', text: 'Did I follow my setup?' },
  { key: 'respectedRisk', text: 'Did I respect my risk?' },
  { key: 'movedSL', text: 'Did I move my stop loss?' },
  { key: 'chased', text: 'Did I chase?' },
  { key: 'revenge', text: 'Did I revenge trade?' },
  { key: 'checklist', text: 'Did I follow the checklist?' },
  { key: 'technicallyValid', text: 'Was the trade technically valid?' },
];

function renderReviewChecks() {
  const el = document.getElementById('review-checks');
  if (!el) return;
  el.innerHTML = REVIEW_QUESTIONS.map(q => `
    <div class="review-item">
      <span>${q.text}</span>
      <div class="yn-group">
        <button class="yn-btn yes ${state.reviewAnswers[q.key] === true ? 'active' : ''}" onclick="setReviewAnswer('${q.key}', true)">Yes</button>
        <button class="yn-btn no ${state.reviewAnswers[q.key] === false ? 'active' : ''}" onclick="setReviewAnswer('${q.key}', false)">No</button>
      </div>
    </div>
  `).join('');
}

function setReviewAnswer(key, val) {
  state.reviewAnswers[key] = val;
  renderReviewChecks();
}

function saveTrade() {
  const entry = document.getElementById('t-entry').value;
  const sl = document.getElementById('t-sl').value;
  const tp = document.getElementById('t-tp').value;
  const resultR = parseFloat(document.getElementById('t-result-r').value);
  const riskPct = parseFloat(document.getElementById('t-risk').value) || state.settings.risk;
  const riskAmt = state.settings.balance * riskPct / 100;
  const result = document.getElementById('t-result').value;
  const resultPL = result === 'BREAKEVEN' ? 0 : (resultR || 0) * riskAmt;

  // Handle screenshot
  const ssFile = document.getElementById('t-screenshot').files[0];
  const doSave = () => {
    const trade = {
      id: state.tradeEditId || Date.now().toString(),
      date: document.getElementById('t-date').value,
      time: document.getElementById('t-time').value,
      direction: document.getElementById('t-direction').value,
      entry, sl, tp,
      riskPct, riskAmount: riskAmt,
      rr: (entry && sl && tp) ? Math.abs(parseFloat(tp) - parseFloat(entry)) / Math.abs(parseFloat(entry) - parseFloat(sl)) : 0,
      result, resultR: result === 'BREAKEVEN' ? 0 : (resultR || 0),
      resultPL: parseFloat(resultPL.toFixed(2)),
      setup: document.getElementById('t-setup').value,
      session: document.getElementById('t-session').value,
      emotion: document.getElementById('t-emotion').value,
      violation: document.getElementById('t-violation').value == '1' ? 1 : 0,
      notes: document.getElementById('t-notes').value,
      good: document.getElementById('t-good').value,
      bad: document.getElementById('t-bad').value,
      change: document.getElementById('t-change').value,
      reviewAnswers: {...state.reviewAnswers},
      screenshot: state.screenshotData || null,
    };
    trade.rr = isNaN(trade.rr) ? 0 : parseFloat(trade.rr.toFixed(2));

    if (state.tradeEditId) {
      const idx = state.trades.findIndex(t => t.id === state.tradeEditId);
      if (idx !== -1) state.trades[idx] = trade;
      toast('Trade updated.', 'success');
    } else {
      state.trades.push(trade);
      toast('Trade saved.', 'success');
    }
    saveState();
    closeModal('modal-add-trade');
    renderAll();
  };

  if (ssFile) {
    toast('Uploading screenshot…', 'info');
    xeUploadScreenshotFile(ssFile, state.tradeEditId || '').then((idOrData) => {
      state.screenshotData = idOrData;
      if (!idOrData) toast('Screenshot skipped (upload failed or too large).', 'error');
      else if (typeof idOrData === 'string' && idOrData.length < 80) toast('Screenshot saved to cloud.', 'success');
      doSave();
    }).catch(() => {
      state.screenshotData = null;
      toast('Screenshot upload failed; trade saved without image.', 'error');
      doSave();
    });

  } else {
    doSave();
  }
}

document.getElementById('t-screenshot').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const prev = document.getElementById('t-screenshot-preview');
  if (prev) prev.innerHTML = '<div class="text-muted text-xs">Preparing screenshot…</div>';
  const localPreview = (dataUrl) => {
    state.screenshotData = dataUrl;
    if (prev) prev.innerHTML = `<img src="${dataUrl}" style="max-width:100%;max-height:120px;border-radius:4px;margin-top:4px"><div class="help">Will upload to cloud when you save the trade.</div>`;
  };
  if (window.XE3AGLE_MEDIA?.compressImage) {
    window.XE3AGLE_MEDIA.compressImage(file).then(localPreview).catch(() => {
      const reader = new FileReader();
      reader.onload = ev => localPreview(ev.target.result);
      reader.readAsDataURL(file);
    });
  } else {
    const reader = new FileReader();
    reader.onload = ev => localPreview(ev.target.result);
    reader.readAsDataURL(file);
  }
});

function deleteTrade(id) {
  showConfirm('Delete Trade', 'Are you sure you want to delete this trade? This cannot be undone.', 'Delete', () => {
    state.trades = state.trades.filter(t => t.id !== id);
    saveState(); renderAll();
    toast('Trade deleted.', 'info');
  });
}

function duplicateTrade(id) {
  const orig = state.trades.find(t => t.id === id);
  if (!orig) return;
  const copy = { ...orig, id: Date.now().toString(), date: state.currentDay };
  state.tradeEditId = null;
  state.reviewAnswers = { ...orig.reviewAnswers };
  state.screenshotData = orig.screenshot || null;
  document.getElementById('modal-trade-title').textContent = 'Add Trade (Copy)';
  document.getElementById('t-date').value = copy.date || state.currentDay;
  document.getElementById('t-time').value = copy.time || '';
  document.getElementById('t-direction').value = copy.direction || 'LONG';
  document.getElementById('t-entry').value = copy.entry || '';
  document.getElementById('t-sl').value = copy.sl || '';
  document.getElementById('t-tp').value = copy.tp || '';
  document.getElementById('t-result').value = copy.result || 'WIN';
  document.getElementById('t-result-r').value = copy.resultR || '';
  document.getElementById('t-setup').value = copy.setup || 'FVG';
  document.getElementById('t-risk').value = copy.riskPct || state.settings.risk;
  document.getElementById('t-emotion').value = copy.emotion || 'Calm';
  document.getElementById('t-violation').value = copy.violation ? '1' : '0';
  document.getElementById('t-notes').value = copy.notes || '';
  document.getElementById('t-good').value = copy.good || '';
  document.getElementById('t-bad').value = copy.bad || '';
  document.getElementById('t-change').value = copy.change || '';
  document.getElementById('t-screenshot-preview').innerHTML = copy.screenshot ? `<img src="${xeScreenshotSrc(copy.screenshot)}" style="max-width:100%;max-height:120px;border-radius:4px">` : '';
  renderReviewChecks();
  openModal('modal-add-trade');
  toast('Trade duplicated — edit and save.', 'info');
}

// ============================================================
// STATS PAGE
// ============================================================
function renderStats() {
  const el = document.getElementById('stats-content');
  if (!el) return;

  const trades = state.trades;
  if (!trades.length) {
    el.innerHTML = `<div class="empty">
      <div class="empty-icon">📊</div>
      <h3>No performance data yet</h3>
      <p>Complete trades to generate statistics.</p>
    </div>`;
    return;
  }

  const wins = trades.filter(t => t.result === 'WIN');
  const losses = trades.filter(t => t.result === 'LOSS');
  const bes = trades.filter(t => t.result === 'BREAKEVEN');
  const totalR = trades.reduce((s, t) => s + (t.resultR || 0), 0);
  const winR = wins.reduce((s, t) => s + (t.resultR || 0), 0);
  const lossR = losses.reduce((s, t) => s + (t.resultR || 0), 0);
  const totalPL = trades.reduce((s, t) => s + (t.resultPL || 0), 0);
  const avgR = totalR / trades.length;
  const avgWin = wins.length ? winR / wins.length : 0;
  const avgLoss = losses.length ? lossR / losses.length : 0;
  const largestWin = wins.length ? Math.max(...wins.map(t => t.resultR || 0)) : 0;
  const largestLoss = losses.length ? Math.min(...losses.map(t => t.resultR || 0)) : 0;
  const pfNum = winR, pfDen = Math.abs(lossR);
  const profitFactor = pfDen > 0 ? pfNum / pfDen : winR > 0 ? Infinity : 0;
  const winRate = trades.length ? (wins.length / trades.length * 100) : 0;
  const violations = trades.filter(t => t.violation).length;
  const avgRisk = trades.length ? trades.reduce((s, t) => s + (t.riskPct || 0), 0) / trades.length : 0;
  const longs = trades.filter(t => t.direction === 'LONG');
  const shorts = trades.filter(t => t.direction === 'SHORT');
  const cur = state.settings.currency;

  // Equity curve
  const eqData = [];
  let running = 0;
  trades.slice().sort((a,b) => Number(a.id) - Number(b.id)).forEach(t => { running += (t.resultR||0); eqData.push(parseFloat(running.toFixed(2))); });

  // Setup performance
  const setupMap = {};
  trades.forEach(t => {
    if (!t.setup) return;
    if (!setupMap[t.setup]) setupMap[t.setup] = { wins: 0, losses: 0, total: 0, R: 0 };
    setupMap[t.setup].total++;
    setupMap[t.setup].R += (t.resultR || 0);
    if (t.result === 'WIN') setupMap[t.setup].wins++;
    if (t.result === 'LOSS') setupMap[t.setup].losses++;
  });

  el.innerHTML = `
    <div class="stat-grid" style="margin-bottom:16px">
      <div class="metric"><div class="metric-label">Total Trades</div><div class="metric-value">${trades.length}</div></div>
      <div class="metric"><div class="metric-label">Wins</div><div class="metric-value text-green">${wins.length}</div></div>
      <div class="metric"><div class="metric-label">Losses</div><div class="metric-value text-red">${losses.length}</div></div>
      <div class="metric"><div class="metric-label">Breakevens</div><div class="metric-value text-amber">${bes.length}</div></div>
      <div class="metric"><div class="metric-label">Win Rate</div><div class="metric-value ${winRate >= 50 ? 'text-green' : 'text-red'}">${winRate.toFixed(1)}%</div></div>
      <div class="metric"><div class="metric-label">Total R</div><div class="metric-value ${totalR >= 0 ? 'metric-pos' : 'metric-neg'}">${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R</div></div>
      <div class="metric"><div class="metric-label">Total P/L</div><div class="metric-value ${totalPL >= 0 ? 'metric-pos' : 'metric-neg'}">${totalPL >= 0 ? '+' : ''}${formatCurrency(totalPL, cur)}</div></div>
      <div class="metric"><div class="metric-label">Avg R/Trade</div><div class="metric-value ${avgR >= 0 ? 'metric-pos' : 'metric-neg'}">${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R</div></div>
      <div class="metric"><div class="metric-label">Avg Winner</div><div class="metric-value text-green">+${avgWin.toFixed(2)}R</div></div>
      <div class="metric"><div class="metric-label">Avg Loser</div><div class="metric-value text-red">${avgLoss.toFixed(2)}R</div></div>
      <div class="metric"><div class="metric-label">Largest Win</div><div class="metric-value text-green">+${largestWin.toFixed(2)}R</div></div>
      <div class="metric"><div class="metric-label">Largest Loss</div><div class="metric-value text-red">${largestLoss.toFixed(2)}R</div></div>
      <div class="metric"><div class="metric-label">Profit Factor</div><div class="metric-value ${profitFactor >= 1.5 ? 'text-green' : 'text-red'}">${isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞'}</div></div>
      <div class="metric"><div class="metric-label">Rule Violations</div><div class="metric-value ${violations ? 'text-red' : ''}">${violations}</div></div>
      <div class="metric"><div class="metric-label">Avg Risk</div><div class="metric-value">${avgRisk.toFixed(2)}%</div></div>
      <div class="metric"><div class="metric-label">Long WR</div><div class="metric-value ${longs.length && longs.filter(t=>t.result==='WIN').length/longs.length>=.5?'text-green':'text-red'}">${longs.length ? (longs.filter(t=>t.result==='WIN').length/longs.length*100).toFixed(0)+'%' : '—'}</div></div>
      <div class="metric"><div class="metric-label">Short WR</div><div class="metric-value ${shorts.length && shorts.filter(t=>t.result==='WIN').length/shorts.length>=.5?'text-green':'text-red'}">${shorts.length ? (shorts.filter(t=>t.result==='WIN').length/shorts.length*100).toFixed(0)+'%' : '—'}</div></div>
    </div>

    <div class="card">
      <div class="card-title">Equity Curve (R)</div>
      ${eqData.length > 1 ? `<canvas id="equity-chart" height="160"></canvas>` : '<div class="text-muted text-xs">Need at least 2 trades.</div>'}
    </div>

    <div class="grid2">
      <div class="card">
        <div class="card-title">Win / Loss Distribution</div>
        <canvas id="wl-chart" height="140"></canvas>
      </div>
      <div class="card">
        <div class="card-title">Session Performance (R)</div>
        <canvas id="session-chart" height="140"></canvas>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <div class="card-title">Setup Performance (R)</div>
        <canvas id="setup-chart" height="140"></canvas>
      </div>
      <div class="card">
        <div class="card-title">Performance by Emotion (R)</div>
        <canvas id="emotion-chart" height="140"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Rule Violations by Setup</div>
      <canvas id="violation-chart" height="120"></canvas>
    </div>
  `;

  setTimeout(() => {
    // ---- EQUITY CURVE ----
    if (eqData.length > 1) drawLineChart('equity-chart', eqData);

    // ---- WIN/LOSS BAR ----
    drawBarChart('wl-chart',
      ['Wins', 'Losses', 'Breakevens'],
      [wins.length, losses.length, bes.length],
      ['#22c55e', '#ef4444', '#f59e0b'],
      { yLabel: 'Trades' }
    );

    // ---- SESSION PERFORMANCE ----
    const sessions = ['London','New York','Asia','Other'];
    const sessLabels = ['London','NY','Asia','Other'];
    const sessR = sessions.map(s2 => trades.filter(t => t.session === s2).reduce((a,t) => a+(t.resultR||0),0));
    drawBarChart('session-chart', sessLabels, sessR, sessR.map(v => v >= 0 ? '#22c55e' : '#ef4444'), { yLabel: 'R', signed: true });

    // ---- SETUP PERFORMANCE ----
    const setupNames = Object.keys(setupMap);
    const setupR = setupNames.map(k => parseFloat(setupMap[k].R.toFixed(2)));
    drawBarChart('setup-chart', setupNames, setupR, setupR.map(v => v >= 0 ? '#22c55e' : '#ef4444'), { yLabel: 'R', signed: true });

    // ---- EMOTION PERFORMANCE ----
    const emotionMap2 = {};
    trades.forEach(t => {
      if (!t.emotion) return;
      if (!emotionMap2[t.emotion]) emotionMap2[t.emotion] = 0;
      emotionMap2[t.emotion] += (t.resultR || 0);
    });
    const emNames = Object.keys(emotionMap2);
    const emR = emNames.map(k => parseFloat(emotionMap2[k].toFixed(2)));
    drawBarChart('emotion-chart', emNames, emR, emR.map(v => v >= 0 ? '#22c55e' : '#ef4444'), { yLabel: 'R', signed: true });

    // ---- VIOLATIONS ----
    const violMap = {};
    trades.filter(t => t.violation).forEach(t => {
      const k = t.setup || 'Unknown';
      violMap[k] = (violMap[k] || 0) + 1;
    });
    const violNames = Object.keys(violMap);
    const violCounts = violNames.map(k => violMap[k]);
    if (violNames.length) {
      drawBarChart('violation-chart', violNames, violCounts, violCounts.map(() => '#ef4444'), { yLabel: 'Violations' });
    } else {
      const vc = document.getElementById('violation-chart');
      if (vc) { const ctx = vc.getContext('2d'); vc.width = vc.offsetWidth; vc.height = 120; ctx.fillStyle = '#5a5a6a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No violations recorded', vc.width/2, 60); }
    }
  }, 50);
}

// ---- CHART DRAWING HELPERS ----
function drawLineChart(id, data) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth; canvas.height = parseInt(canvas.getAttribute('height')) || 160;
  const W = canvas.width, H = canvas.height, pad = 40;
  const minV = Math.min(0, ...data), maxV = Math.max(0, ...data);
  const range = maxV - minV || 1;
  const toX = i => pad + (W - pad * 2) * i / (data.length - 1);
  const toY = v => H - pad - (H - pad * 2) * (v - minV) / range;
  ctx.clearRect(0, 0, W, H);
  // Grid lines
  ctx.strokeStyle = '#1a1a1d'; ctx.lineWidth = 1;
  [minV, 0, maxV].forEach(v => {
    ctx.beginPath(); ctx.moveTo(pad, toY(v)); ctx.lineTo(W - pad, toY(v)); ctx.stroke();
  });
  // Zero line
  ctx.strokeStyle = '#3a3a3f'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, toY(0)); ctx.lineTo(W - pad, toY(0)); ctx.stroke();
  // Fill under curve
  ctx.beginPath();
  data.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
  ctx.lineTo(toX(data.length - 1), toY(0));
  ctx.lineTo(toX(0), toY(0));
  ctx.closePath();
  ctx.fillStyle = 'rgba(34,197,94,0.06)';
  ctx.fill();
  // Line
  ctx.beginPath(); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
  data.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
  ctx.stroke();
  // Dots
  data.forEach((v, i) => {
    ctx.beginPath(); ctx.fillStyle = v >= 0 ? '#22c55e' : '#ef4444';
    ctx.arc(toX(i), toY(v), 3, 0, Math.PI * 2); ctx.fill();
  });
  // Labels
  ctx.fillStyle = '#5a5a6a'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText(maxV.toFixed(1)+'R', pad - 4, toY(maxV) + 4);
  ctx.fillText(minV.toFixed(1)+'R', pad - 4, toY(minV) + 4);
  ctx.fillText('0R', pad - 4, toY(0) + 4);
  // Trade number labels
  ctx.textAlign = 'center';
  data.forEach((v, i) => {
    if (data.length <= 20 || i % Math.ceil(data.length / 10) === 0) {
      ctx.fillText(i + 1, toX(i), H - 4);
    }
  });
}

function drawBarChart(id, labels, values, colors, opts = {}) {
  const canvas = document.getElementById(id);
  if (!canvas || !labels.length) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = parseInt(canvas.getAttribute('height')) || 140;
  const W = canvas.width, H = canvas.height;
  const padL = 42, padB = 28, padT = 12, padR = 8;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const maxV = Math.max(0, ...values.map(Math.abs)) || 1;
  const minV = opts.signed ? Math.min(0, ...values) : 0;
  const range = maxV - minV || 1;
  const barW = Math.max(6, chartW / labels.length * 0.6);
  const gap = chartW / labels.length;
  const toY = v => padT + chartH - chartH * (v - minV) / range;
  const zeroY = toY(0);
  ctx.clearRect(0, 0, W, H);
  // Zero line
  ctx.strokeStyle = '#3a3a3f'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(W - padR, zeroY); ctx.stroke();
  // Bars
  labels.forEach((lbl, i) => {
    const x = padL + gap * i + gap / 2;
    const v = values[i] || 0;
    const barH = Math.abs(chartH * v / range);
    const barY = v >= 0 ? zeroY - barH : zeroY;
    ctx.fillStyle = Array.isArray(colors) ? (colors[i] || '#3b82f6') : colors;
    ctx.fillRect(x - barW / 2, barY, barW, barH || 1);
    // Value label
    ctx.fillStyle = '#9a9aaa'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    const dispV = Number.isInteger(v) ? v : v.toFixed(1);
    ctx.fillText(v >= 0 ? (opts.signed && v > 0 ? '+'+dispV : dispV) : dispV, x, v >= 0 ? barY - 3 : barY + barH + 10);
    // X label
    ctx.fillStyle = '#5a5a6a'; ctx.font = '10px sans-serif';
    const shortLbl = lbl.length > 8 ? lbl.slice(0, 7) + '…' : lbl;
    ctx.fillText(shortLbl, x, H - 6);
  });
  // Y axis label
  if (opts.yLabel) {
    ctx.save(); ctx.translate(10, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#5a5a6a'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(opts.yLabel, 0, 0); ctx.restore();
  }
}

// ============================================================
// PSYCHOLOGY PAGE
// ============================================================
const PSYCH_CARDS = [
  { id: 'greed', title: 'GREED', short: 'I don\'t need every move.', detail: 'Greed makes you deviate from your plan — sizing up, moving targets, re-entering when the trade is done. The edge only exists when you follow the rules consistently. One missed move is nothing. A broken risk rule can erase weeks.', mantra: 'My edge is in consistency, not in catching every pip.' },
  { id: 'fomo', title: 'FOMO', short: 'If I missed it, I missed it.', detail: 'Fear of missing out causes late entries with poor risk/reward and wide stops. The market will create another setup. Chasing a move that already happened is not trading — it\'s gambling with bad odds.', mantra: 'Another setup is coming. I only take the one I planned.' },
  { id: 'revenge', title: 'REVENGE', short: 'The market does not owe me.', detail: 'After a loss, the urge to "get it back" overrides logic. You start forcing setups, ignoring rules, trading size you shouldn\'t. The market does not know or care about your P/L. It has no memory. A loss is a cost of doing business.', mantra: 'A loss is a business expense. I move on.' },
  { id: 'impatience', title: 'IMPATIENCE', short: 'No setup = no trade.', detail: 'Trading out of boredom is expensive. There is no obligation to be in a trade. The best traders miss more than they take. Sitting in cash is a position. Waiting for your A+ setup IS the job.', mantra: 'Inaction is action. Waiting IS trading.' },
  { id: 'overconfidence', title: 'OVERCONFIDENCE', short: 'One win doesn\'t change my risk.', detail: 'After a good run, it feels like you\'ve "figured it out." This is when traders blow up. Confidence should come from following the process — not from recent results. Your last trade does not change your risk parameters.', mantra: 'My edge is the process. Not my last trade.' },
  { id: 'doubt', title: 'DOUBT', short: 'Trust the analysis, not the noise.', detail: 'Self-doubt causes hesitation, missed entries, premature exits. If you\'ve done the work — if the checklist is complete, the setup is valid, the risk is defined — then execute. Doubt after the fact is just noise.', mantra: 'I did the work. I trust the plan.' },
  { id: 'loss-aversion', title: 'LOSS AVERSION', short: 'Moving SL is not protecting capital.', detail: 'Moving your stop loss wider to "give the trade more room" violates your original risk. The plan defined the stop. If you move it, you are no longer following the plan — you are hoping. Hope is not a strategy.', mantra: 'The stop was part of the plan. I respect it.' },
  { id: 'tilt', title: 'TILT', short: 'Emotion is a signal to stop.', detail: 'Tilt is the state where emotion has taken over decision-making. You know you\'re on tilt when a loss feels personal, when you need to "win it back", when you feel angry at the market. This is the time to close the charts, not open another trade.', mantra: 'When I feel this way, I stop. No exceptions.' },
];

function renderPsychology() {
  const grid = document.getElementById('psych-cards');
  if (grid) {
    grid.innerHTML = PSYCH_CARDS.map(c => `
      <div class="psych-card" id="psych-${c.id}" onclick="togglePsychCard('${c.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <h3 style="color:var(--text)">${c.title}</h3>
          <span style="font-size:10px;color:var(--text3);margin-left:8px" id="psych-arrow-${c.id}">▼</span>
        </div>
        <p style="margin-top:4px">${c.short}</p>
        <div id="psych-detail-${c.id}" style="display:none;margin-top:10px">
          <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px">${c.detail}</div>
          <div style="background:var(--surface);border-left:2px solid var(--border2);padding:8px 10px;border-radius:0 4px 4px 0;font-size:12px;font-style:italic;color:var(--text)">${c.mantra}</div>
        </div>
      </div>
    `).join('');
  }

  // Pattern from journal
  const patternEl = document.getElementById('psych-pattern');
  if (patternEl) {
    const emotionMap = {};
    state.trades.forEach(t => {
      if (!t.emotion) return;
      if (!emotionMap[t.emotion]) emotionMap[t.emotion] = { trades: 0, wins: 0, R: 0 };
      emotionMap[t.emotion].trades++;
      emotionMap[t.emotion].R += (t.resultR || 0);
      if (t.result === 'WIN') emotionMap[t.emotion].wins++;
    });

    if (!Object.keys(emotionMap).length) {
      patternEl.innerHTML = '<div class="text-muted text-xs">No pattern data yet. Complete trades to see emotional patterns.</div>';
    } else {
      patternEl.innerHTML = `<div style="display:grid;gap:8px;font-size:13px">${
        Object.entries(emotionMap).sort((a,b) => b[1].trades - a[1].trades).map(([em, data]) => `
          <div class="flex-between">
            <span>${em}</span>
            <span style="display:flex;gap:12px">
              <span class="text-muted">${data.trades} trades</span>
              <span class="text-muted">${data.trades ? (data.wins/data.trades*100).toFixed(0) : 0}% WR</span>
              <span class="${data.R>=0?'text-green':'text-red'}">${data.R>=0?'+':''}${data.R.toFixed(2)}R</span>
            </span>
          </div>
        `).join('')
      }</div>`;
    }
  }

  const refEl = document.getElementById('psych-reflection');
  if (refEl) refEl.value = state.psychology.reflection || '';
}

function togglePsychCard(id) {
  const detail = document.getElementById('psych-detail-' + id);
  const arrow = document.getElementById('psych-arrow-' + id);
  const card = document.getElementById('psych-' + id);
  if (!detail) return;
  const open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
  if (card) card.style.borderColor = open ? '' : 'var(--border2)';
}

function savePsychReflection() {
  state.psychology.reflection = document.getElementById('psych-reflection')?.value || '';
  saveState();
  toast('Reflection saved.', 'success');
}

// ============================================================
// DAILY REVIEW
// ============================================================
function renderDailyReviewPanel() {
  const todayTrades = getDailyTrades();
  const violations = todayTrades.filter(t => t.violation).length;
  const totalQ = todayTrades.length * REVIEW_QUESTIONS.length;
  let followed = 0;
  todayTrades.forEach(t => {
    REVIEW_QUESTIONS.forEach(q => { if (t.reviewAnswers && t.reviewAnswers[q.key] === true) followed++; });
  });
  const adherencePct = totalQ > 0 ? Math.round(followed / totalQ * 100) : 0;

  const drL = document.getElementById('dr-checklist-pct');
  const drV = document.getElementById('dr-violations');
  const drE = document.getElementById('dr-emotion');
  if (drL) { drL.textContent = totalQ > 0 ? adherencePct + '%' : '—'; drL.className = 'metric-value ' + (adherencePct >= 80 ? 'text-green' : adherencePct >= 50 ? 'text-amber' : 'text-red'); }
  if (drV) { drV.textContent = violations; drV.className = 'metric-value ' + (violations > 0 ? 'text-red' : ''); }
  if (drE) drE.textContent = state.preparation.emotion || '—';

  // Restore saved review
  if (!state.dailyReview) state.dailyReview = {};
  const saved = state.dailyReview[state.currentDay] || {};
  const el1 = document.getElementById('daily-review-learned');
  const el2 = document.getElementById('daily-review-tomorrow');
  if (el1) el1.value = saved.learned || '';
  if (el2) el2.value = saved.tomorrow || '';

  const savedEl = document.getElementById('daily-review-saved');
  if (savedEl && saved.learned) {
    savedEl.className = 'alert alert-green mt8';
    savedEl.textContent = '✓ Review saved for today.';
    savedEl.style.display = 'flex';
  } else if (savedEl) { savedEl.style.display = 'none'; }
}

function saveDailyReview() {
  const learned = document.getElementById('daily-review-learned')?.value || '';
  const tomorrow = document.getElementById('daily-review-tomorrow')?.value || '';
  if (!state.dailyReview) state.dailyReview = {};
  state.dailyReview[state.currentDay] = { learned, tomorrow, savedAt: new Date().toISOString() };
  saveState();
  toast('Daily review saved.', 'success');
  renderDailyReviewPanel();
}

// ============================================================
// STATUS PAGE
// ============================================================
function renderStatusPage() {
  const el = document.getElementById('status-content');
  if (!el) return;

  const status = getTradingStatus();
  const stops = getStopReasons();
  const dailyR = getDailyR();
  const dailyPL = getDailyPL();
  const s = state.settings;
  const ct = canTrade();

  const statusLabels = {
    PREPARATION: ['PREPARATION', 'text-muted'],
    ANALYSIS: ['ANALYSIS', 'text-muted'],
    WAITING: ['WAITING', 'text-amber'],
    TRADE_APPROVED: ['TRADE APPROVED', 'text-green'],
    TRADE_ACTIVE: ['TRADE ACTIVE', 'text-blue'],
    TERMINATED: ['TERMINATED', 'text-red'],
  };
  const [label, colorClass] = statusLabels[status] || ['—', ''];

  el.innerHTML = `
    <div class="card" style="text-align:center;padding:32px">
      <div style="font-size:11px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase;margin-bottom:10px">Current Status</div>
      <div style="font-size:36px;font-weight:900;letter-spacing:.04em" class="${colorClass}">${label}</div>
    </div>

    <div class="grid2" style="margin-top:16px">
      <div class="card">
        <div class="card-title">Session Limits</div>
        <div style="display:grid;gap:8px;font-size:13px">
          <div class="flex-between">
            <span class="text-muted">Daily P/L</span>
            <span class="${dailyPL >= 0 ? 'text-green' : 'text-red'}">${dailyPL >= 0 ? '+' : ''}${formatCurrency(dailyPL, s.currency)}</span>
          </div>
          <div class="flex-between">
            <span class="text-muted">Daily R</span>
            <span class="${dailyR >= 0 ? 'text-green' : 'text-red'}">${dailyR >= 0 ? '+' : ''}${dailyR.toFixed(2)}R / ${s.target}R</span>
          </div>
          <div class="flex-between">
            <span class="text-muted">Trades today</span>
            <span>${getDailyTrades().length} / ${s.maxTrades}</span>
          </div>
          <div class="flex-between">
            <span class="text-muted">Consecutive losses</span>
            <span class="${getConsecLosses() >= s.maxConsecLoss ? 'text-red' : ''}">${getConsecLosses()} / ${s.maxConsecLoss}</span>
          </div>
          <div class="flex-between">
            <span class="text-muted">Loss limit</span>
            <span class="${Math.abs(dailyPL) >= s.balance * s.dailyLoss / 100 ? 'text-red' : ''}">${(Math.abs(Math.min(dailyPL,0)) / (s.balance * s.dailyLoss / 100) * 100).toFixed(0)}% used</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Active Restrictions</div>
        ${stops.length ? stops.map(r => `<div class="alert alert-red" style="margin-bottom:6px"><span class="alert-icon">✗</span><span>${r}</span></div>`).join('') : '<div class="alert alert-green"><span class="alert-icon">✓</span><span>No active restrictions</span></div>'}
        ${!ct.allowed && !stops.length ? `<div style="margin-top:12px"><div class="card-title">Pending Conditions</div>${ct.reasons.map(r=>`<div class="check-row fail"><span class="check-icon">✗</span><span>${r}</span></div>`).join('')}</div>` : ''}
      </div>
    </div>
  `;

  renderKillSwitch();

  // History — include today's live session at the top
  const histEl = document.getElementById('history-grid');
  if (histEl) {
    const todayTrades = getDailyTrades();
    const todayR = getDailyR();
    const todayWins = todayTrades.filter(t => t.result === 'WIN').length;
    const todayLosses = todayTrades.filter(t => t.result === 'LOSS').length;
    const todayViol = todayTrades.filter(t => t.violation).length;
    const archived = [...state.dailyHistory].sort((a,b) => b.date.localeCompare(a.date));

    if (!archived.length && !todayTrades.length) {
      histEl.innerHTML = '<div class="text-muted text-xs">No sessions yet.</div>';
    } else {
      const todayCard = todayTrades.length ? `
        <div class="cal-day" style="border-color:var(--blue-border)" onclick="showDayDetail('${state.currentDay}')">
          <div class="cal-day-date" style="color:var(--blue)">${formatDate(state.currentDay, state.settings.dateFormat)} — TODAY</div>
          <div class="cal-day-r ${todayR >= 0 ? 'text-green' : 'text-red'}">${todayR >= 0 ? '+' : ''}${todayR.toFixed(2)}R</div>
          <div class="text-xs text-muted">${todayTrades.length} trades · ${todayWins}W ${todayLosses}L${todayViol ? ' · <span style="color:var(--red)">' + todayViol + ' viol.</span>' : ''}</div>
        </div>
      ` : '';
      histEl.innerHTML = todayCard + archived.map(day => `
        <div class="cal-day" onclick="showDayDetail('${day.date}')">
          <div class="cal-day-date">${formatDate(day.date, state.settings.dateFormat)}</div>
          <div class="cal-day-r ${day.totalR >= 0 ? 'text-green' : 'text-red'}">${day.totalR >= 0 ? '+' : ''}${day.totalR}R</div>
          <div class="text-xs text-muted">${day.trades} trades · ${day.wins}W ${day.losses}L${day.violations ? ' · <span style="color:var(--red)">' + day.violations + ' viol.</span>' : ''}</div>
        </div>
      `).join('');
    }
  }
}

function showDayDetail(dateKey) {
  const day = state.dailyHistory.find(d => d.date === dateKey) || null;
  const trades = state.trades.filter(t => t.date === dateKey);
  const liveR = trades.reduce((s,t) => s + (t.resultR||0), 0);
  const displayR = day ? day.totalR : liveR;
  const review = state.dailyReview?.[dateKey];
  document.getElementById('day-detail-title').textContent = formatDate(dateKey, state.settings.dateFormat);
  document.getElementById('day-detail-content').innerHTML = `
    <div class="grid2" style="margin-bottom:16px">
      <div class="metric"><div class="metric-label">Total R</div><div class="metric-value ${displayR>=0?'metric-pos':'metric-neg'}">${displayR>=0?'+':''}${displayR.toFixed(2)}R</div></div>
      <div class="metric"><div class="metric-label">Trades</div><div class="metric-value">${trades.length}</div></div>
    </div>
    ${trades.length ? `<div style="display:grid;gap:8px;margin-bottom:16px">
      ${trades.map(t => `<div class="flex-between" style="font-size:13px;padding:6px;background:var(--surface2);border-radius:4px">
        <span><span class="pill ${t.direction==='LONG'?'pill-green':'pill-red'}">${t.direction}</span> ${t.setup}</span>
        <span class="${t.resultR>0?'text-green':t.resultR<0?'text-red':'text-muted'}">${t.resultR>0?'+':''}${t.resultR}R</span>
      </div>`).join('')}
    </div>` : '<div class="text-muted text-xs" style="margin-bottom:12px">No trade data for this day.</div>'}
    ${review ? `<div class="divider"></div>
      <div style="font-size:13px;display:grid;gap:10px;margin-top:12px">
        ${review.learned ? `<div><div class="card-title" style="margin-bottom:4px">What I learned</div><div style="color:var(--text2)">${review.learned}</div></div>` : ''}
        ${review.tomorrow ? `<div><div class="card-title" style="margin-bottom:4px">Tomorrow I will</div><div style="color:var(--text2)">${review.tomorrow}</div></div>` : ''}
      </div>` : ''}
  `;
  openModal('modal-day-detail');
}

// ============================================================
// SETTINGS PAGE
// ============================================================
function renderSettings() {
  const s = state.settings;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal('s-balance', s.balance);
  setVal('s-currency', s.currency);
  setVal('s-instrument', s.instrument || '');
  setVal('s-ptval', s.ptval || 1);
  setVal('s-risk', s.risk);
  setVal('s-dailyloss', s.dailyLoss);
  setVal('s-target', s.target);
  setVal('s-maxtrades', s.maxTrades);
  setVal('s-maxloss', s.maxConsecLoss);
  setVal('s-minrr', s.minRR);
  setVal('s-timezone', s.timezone || 'UTC');
  setVal('s-dateformat', s.dateFormat || 'MM/DD/YYYY');
  setVal('s-london-open', s.londonOpen || '08:00');
  setVal('s-ny-open', s.nyOpen || '13:00');
  setVal('s-asia-open', s.asiaOpen || '00:00');
}

function saveSettings() {
  const getNum = id => parseFloat(document.getElementById(id)?.value) || 0;
  const getStr = id => document.getElementById(id)?.value || '';

  state.settings.balance = getNum('s-balance') || state.settings.balance;
  state.settings.currency = getStr('s-currency') || 'USD';
  state.settings.instrument = getStr('s-instrument');
  state.settings.ptval = getNum('s-ptval') || 1;
  state.settings.risk = getNum('s-risk') || 0.5;
  state.settings.dailyLoss = getNum('s-dailyloss') || 1;
  state.settings.target = getNum('s-target') || 2;
  state.settings.maxTrades = Math.round(getNum('s-maxtrades')) || 3;
  state.settings.maxConsecLoss = Math.round(getNum('s-maxloss')) || 2;
  state.settings.minRR = getNum('s-minrr') || 2;
  state.settings.timezone = getStr('s-timezone') || 'UTC';
  state.settings.dateFormat = getStr('s-dateformat') || 'MM/DD/YYYY';
  state.settings.londonOpen = getStr('s-london-open') || '08:00';
  state.settings.nyOpen = getStr('s-ny-open') || '13:00';
  state.settings.asiaOpen = getStr('s-asia-open') || '00:00';
  saveState(); renderAll();
  toast('Settings saved.', 'success');
}

function exportBackup() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'xe3agle-backup-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  toast('Backup exported.', 'success');
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed.settings || !Array.isArray(parsed.trades)) throw new Error('Invalid backup structure');
      state = deepMerge(state, parsed);
      saveState(); renderAll();
      toast('Backup imported successfully.', 'success');
    } catch(err) {
      toast('Import failed: ' + err.message + '. Existing data unchanged.', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ============================================================
// KILL SWITCH
// ============================================================
function renderKillSwitch() {
  const el = document.getElementById('kill-switch-area');
  if (!el) return;
  if (state.killSwitch) {
    el.innerHTML = `
      <div class="alert alert-red" style="margin-bottom:12px">
        <span class="alert-icon">✗</span>
        <span>Kill switch active — trading terminated.<br><small style="opacity:.7">Reason: ${state.killReason || 'Manual'}</small></span>
      </div>
      <button class="btn" onclick="deactivateKillSwitch()">Deactivate Kill Switch (use with caution)</button>
    `;
  } else if (isStopped()) {
    el.innerHTML = `<div class="alert alert-amber"><span>Session already terminated by a hard rule. Use Session Reset in Settings to start fresh.</span></div>`;
  } else {
    el.innerHTML = `<button class="btn btn-danger" onclick="activateKillSwitch()">Activate Kill Switch — Stop Trading Now</button>`;
  }
}

function activateKillSwitch() {
  showConfirm('Activate Kill Switch', 'This will terminate trading for the rest of the session. Are you sure?', 'Terminate Session', () => {
    state.killSwitch = true;
    state.killReason = 'Manual kill switch — you chose to stop.';
    saveState(); renderAll();
    toast('Kill switch activated. Trading terminated.', 'error');
  });
}

function deactivateKillSwitch() {
  showConfirm('Deactivate Kill Switch', 'Only do this if you are certain you can trade with discipline today.', 'Deactivate', () => {
    state.killSwitch = false;
    state.killReason = '';
    saveState(); renderAll();
    toast('Kill switch deactivated.', 'info');
  });
}

function openResetSession() { openModal('modal-reset-session'); }
function confirmResetSession() {
  const val = document.getElementById('reset-confirm-input').value.trim();
  if (val !== 'RESET') { toast('Type RESET to confirm.', 'error'); return; }
  state.preparation = { emotion: '', focus: '', news: '', markets: '', rulesAccepted: false };
  state.analysis = { biasDir: '', biasHTF: '', biasETF: '', biasNotes: '', liquidity: [], liquidityNotes: '', sweep: false, sweepNotes: '', mss: false, mssNotes: '', entryModel: '', direction: '', entry: '', sl: '', tp: '', ptval: '' };
  state.activeTrade = null;
  state.killSwitch = false;
  state.killReason = '';
  saveState(); renderAll();
  closeModal('modal-reset-session');
  toast('Session reset.', 'info');
}

function openDeleteAll() { openModal('modal-delete-all'); }
function confirmDeleteAll() {
  const val = document.getElementById('delete-confirm-input').value.trim();
  if (val !== 'DELETE') { toast('Type DELETE to confirm.', 'error'); return; }
  try { localStorage.removeItem('xe3agle_state'); } catch(e) {}
  state = deepMerge({
    settings: {...DEFAULT_SETTINGS}, currentDay: null,
    preparation: { emotion: '', focus: '', news: '', markets: '', rulesAccepted: false },
    analysis: { biasDir: '', biasHTF: '', biasETF: '', biasNotes: '', liquidity: [], liquidityNotes: '', sweep: false, sweepNotes: '', mss: false, mssNotes: '', entryModel: '', direction: '', entry: '', sl: '', tp: '', ptval: '' },
    activeTrade: null, trades: [], dailyHistory: [],
    psychology: { reflection: '' }, dailyReview: {}, killSwitch: false, killReason: '',
    ui: { page: 'today' }, tradeEditId: null, reviewAnswers: {}, screenshotData: null,
  }, {});
  checkDayReset(); renderAll();
  closeModal('modal-delete-all');
  toast('All data deleted.', 'info');
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + page);
  const nav = document.getElementById('nav-' + page);
  if (pg) pg.classList.add('active');
  if (nav) nav.classList.add('active');
  state.ui.page = page;
  const titles = { workflow: 'Trading Workflow', today: 'Today', prepare: 'Prepare', setup: 'Setup & Analysis', check: 'Pre-Trade Check', journal: 'Journal', stats: 'Stats', psychology: 'Psychology', status: 'Status', settings: 'Settings', guide: 'How To Use' };
  document.getElementById('topbar-title').textContent = titles[page] || page;
  closeSidebar();

  // Page-specific renders
  if (page === 'today') renderToday();
  if (page === 'prepare') renderPrepare();
  if (page === 'setup') renderSetup();
  if (page === 'check') renderPretradeChecklist();
  if (page === 'journal') renderJournal();
  if (page === 'stats') renderStats();
  if (page === 'psychology') renderPsychology();
  if (page === 'status') renderStatusPage();
  if (page === 'settings') renderSettings();
  if (page === 'guide') {} // static content, no render needed
}

function renderAll() {
  const page = state.ui.page || 'today';
  navigate(page);
}

// ============================================================
// MODAL
// ============================================================
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ============================================================
// SIDEBAR
// ============================================================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const map = { 'd': 'today', 'p': 'prepare', 'c': 'check', 'j': 'journal', 's': 'stats' };
  if (map[e.key.toLowerCase()]) navigate(map[e.key.toLowerCase()]);
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

// ============================================================
// CONFIRM MODAL (replaces window.confirm which is blocked in iframes)
// ============================================================
let _confirmCallback = null;
function showConfirm(title, message, okLabel, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-ok-btn').textContent = okLabel || 'Confirm';
  _confirmCallback = callback;
  openModal('modal-confirm');
}
function confirmOk() {
  closeModal('modal-confirm');
  if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
}

// ============================================================
// TOAST
// ============================================================
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
  const tz = state.settings.timezone || 'UTC';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.getElementById('sidebar-time');
  if (el) el.textContent = timeStr + ' ' + tz;
  const tEl = document.getElementById('today-time');
  if (tEl) tEl.textContent = now.toLocaleTimeString('en-US', { timeZone: tz });
}

// ============================================================
// UTILITIES
// ============================================================
function formatCurrency(val, cur) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
  } catch(e) {
    return (cur || '$') + (val || 0).toFixed(2);
  }
}

function formatDate(dateStr, fmt) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-');
    if (fmt === 'DD/MM/YYYY') return `${d}/${m}/${y}`;
    if (fmt === 'YYYY-MM-DD') return dateStr;
    return `${m}/${d}/${y}`;
  } catch(e) { return dateStr; }
}

// ============================================================
// INIT
// ============================================================
function init() {
  // Dismiss splash after brief delay
  requestAnimationFrame(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 180); }
  });

  loadState();
  checkDayReset();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(checkDayReset, 60000);
  navigate(state.ui.page || 'today');
  renderSettings();
}

init();
