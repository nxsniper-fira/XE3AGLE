import test from 'node:test';
import assert from 'node:assert/strict';
import { statistics } from '../js/analytics/statistics-engine.js';
import { expectancy } from '../js/analytics/performance.js';
test('statistics and expectancy',()=>{const s=statistics([{result:'WIN',resultR:2},{result:'LOSS',resultR:-1}]);assert.equal(s.winRate,50);assert.equal(expectancy(s),.5)});
