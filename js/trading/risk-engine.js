/**
 * XE3AGLE v20 — pure risk calculation (no DOM).
 * Used by legacy UI and unit tests.
 */
export function calculateRisk({
  balance,
  riskPct,
  entry,
  sl,
  tp,
  pointValue = 1,
}) {
  const b = Number(balance);
  const r = Number(riskPct);
  const e = Number(entry);
  const s = Number(sl);
  const t = Number(tp);
  const pv = Number(pointValue);

  if (![b, r, e, s, t, pv].every(Number.isFinite) || b <= 0 || r <= 0 || pv <= 0) {
    return { valid: false, reasons: ['Invalid risk inputs'] };
  }

  const stop = Math.abs(e - s);
  const target = Math.abs(t - e);
  if (stop <= 0) {
    return { valid: false, reasons: ['Stop distance must be greater than zero'] };
  }

  const riskAmount = (b * r) / 100;
  const positionSize = riskAmount / (stop * pv);
  const potentialLoss = riskAmount;
  const potentialProfit = target * positionSize * pv;
  const rr = target / stop;

  return {
    valid: true,
    riskAmount,
    riskPct: r,
    stopDistance: stop,
    targetDistance: target,
    rr,
    positionSize,
    potentialLoss,
    potentialProfit,
  };
}

/**
 * Evaluate whether a proposed trade is allowed given current settings + day state.
 * Pure function — does not mutate anything.
 */
export function evaluateTradeApproval({
  settings = {},
  dailyTrades = [],
  killSwitch = false,
  killReason = '',
  proposed = {},
}) {
  const reasons = [];
  const warnings = [];

  if (killSwitch) {
    reasons.push(killReason || 'Kill switch is active');
  }

  const maxTrades = Number(settings.maxTrades) || 0;
  if (maxTrades > 0 && dailyTrades.length >= maxTrades) {
    reasons.push(`Max trades reached (${maxTrades})`);
  }

  const maxConsec = Number(settings.maxConsecLoss) || 0;
  if (maxConsec > 0) {
    let consec = 0;
    for (let i = dailyTrades.length - 1; i >= 0; i--) {
      const t = dailyTrades[i];
      if (t.result === 'LOSS' || Number(t.resultR) < 0) consec++;
      else break;
    }
    if (consec >= maxConsec) {
      reasons.push(`Max consecutive losses reached (${maxConsec})`);
    }
  }

  const dailyLossPct = Number(settings.dailyLoss) || 0;
  const balance = Number(settings.balance) || 0;
  if (dailyLossPct > 0 && balance > 0) {
    const dayPL = dailyTrades.reduce((sum, t) => sum + (Number(t.pl) || 0), 0);
    const limit = -(balance * dailyLossPct) / 100;
    if (dayPL <= limit) {
      reasons.push(`Daily loss limit reached (${dailyLossPct}%)`);
    }
  }

  const minRR = Number(settings.minRR) || 0;
  const risk = calculateRisk({
    balance: settings.balance,
    riskPct: settings.risk,
    entry: proposed.entry,
    sl: proposed.sl,
    tp: proposed.tp,
    pointValue: proposed.pointValue ?? settings.ptval ?? 1,
  });

  if (!risk.valid) {
    reasons.push(...(risk.reasons || ['Invalid risk parameters']));
  } else if (minRR > 0 && risk.rr < minRR) {
    reasons.push(`Risk/Reward ${risk.rr.toFixed(2)} below minimum ${minRR}:1`);
  }

  if (risk.valid && risk.rr < (minRR || 1.5)) {
    warnings.push('RR is tight relative to your rules');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    warnings,
    risk: risk.valid ? risk : null,
  };
}

/** Bridge for legacy code that expects window.validateTrade */
export function validateTrade(state) {
  if (typeof window !== 'undefined' && typeof window.validateTrade === 'function' && window.validateTrade !== validateTrade) {
    try {
      return window.validateTrade();
    } catch (_) {}
  }
  const s = state || (typeof window !== 'undefined' ? window.state : null) || {};
  const today = s.currentDay;
  const daily = (s.trades || []).filter((t) => t.date === today);
  return evaluateTradeApproval({
    settings: s.settings || {},
    dailyTrades: daily,
    killSwitch: !!s.killSwitch,
    killReason: s.killReason || '',
    proposed: {
      entry: s.analysis?.entry,
      sl: s.analysis?.sl,
      tp: s.analysis?.tp,
      pointValue: s.analysis?.ptval || s.settings?.ptval,
    },
  });
}
