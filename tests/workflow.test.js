import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKFLOW } from '../js/trading/workflow-engine.js';
test('workflow is ordered',()=>assert.deepEqual(WORKFLOW,['prepare','rules','analysis','risk','check','active','review','journal','daily']));
