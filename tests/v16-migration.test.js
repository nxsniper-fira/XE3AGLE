import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState } from '../js/core/migration-manager.js';

test('v16 migration creates production data containers',()=>{
  const s=migrateState({settings:{balance:10000},trades:[]});
  assert.equal(s._schemaVersion,19);
  assert.ok(s.v16);
  assert.ok(Array.isArray(s.v16.tags));
  assert.ok(Array.isArray(s.v16.media));
  assert.ok(Array.isArray(s.v16.audit));
  assert.ok(s.v16.challenge);
  assert.ok(s.v16.protection);
  assert.ok(s.v16.deviceId);
});
