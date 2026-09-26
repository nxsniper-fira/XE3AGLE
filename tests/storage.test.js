import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidState } from '../data/schema.js';
test('schema accepts core state',()=>assert.equal(isValidState({settings:{},trades:[]}),true));
test('schema rejects malformed state',()=>assert.equal(isValidState({}),false));
