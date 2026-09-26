import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTrades } from '../js/journal/trade-history.js';
test('journal filters',()=>assert.equal(filterTrades([{result:'WIN',direction:'LONG'},{result:'LOSS',direction:'SHORT'}],{result:'WIN'}).length,1));
