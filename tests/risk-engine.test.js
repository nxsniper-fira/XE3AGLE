import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRisk, evaluateTradeApproval } from '../js/trading/risk-engine.js';

test('risk engine calculates position size', () => {
  const r = calculateRisk({ balance: 10000, riskPct: 0.5, entry: 100, sl: 95, tp: 110, pointValue: 1 });
  assert.equal(r.valid, true);
  assert.equal(r.riskAmount, 50);
  assert.equal(r.stopDistance, 5);
  assert.equal(r.rr, 2);
  assert.equal(r.positionSize, 10);
});

test('zero stop is rejected', () => {
  assert.equal(calculateRisk({ balance: 10000, riskPct: 1, entry: 100, sl: 100, tp: 110 }).valid, false);
});

test('approval blocks when max trades reached', () => {
  const r = evaluateTradeApproval({
    settings: { maxTrades: 2, balance: 10000, risk: 0.5, minRR: 1 },
    dailyTrades: [{ result: 'WIN' }, { result: 'WIN' }],
    proposed: { entry: 100, sl: 95, tp: 110 },
  });
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /max trades/i.test(x)));
});

test('approval blocks low RR', () => {
  const r = evaluateTradeApproval({
    settings: { maxTrades: 5, balance: 10000, risk: 0.5, minRR: 2 },
    dailyTrades: [],
    proposed: { entry: 100, sl: 95, tp: 107 },
  });
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /risk\/reward/i.test(x)));
});

test('approval allows valid trade', () => {
  const r = evaluateTradeApproval({
    settings: { maxTrades: 5, balance: 10000, risk: 0.5, minRR: 2 },
    dailyTrades: [],
    proposed: { entry: 100, sl: 95, tp: 110 },
  });
  assert.equal(r.allowed, true);
  assert.equal(r.risk.rr, 2);
});
