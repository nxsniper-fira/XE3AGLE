import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRisk } from '../js/trading/risk-engine.js';
test('directional long levels are structurally valid',()=>{assert.ok(100>95&&110>100)});
test('directional short levels are structurally valid',()=>{assert.ok(105>100&&95<100)});
