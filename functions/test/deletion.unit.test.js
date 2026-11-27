import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anonymizeAttribution, deletionRequestError } from '../deletion-policy.js';
test('deletion requires the caller identity, a recent sign-in and explicit confirmation', () => {
  assert.equal(deletionRequestError(null, 'DELETE', 1000), 'unauthenticated');
  assert.equal(deletionRequestError({ uid: 'a', token: { auth_time: 600 } }, 'DELETE', 1000), 'recent-login-required');
  assert.equal(deletionRequestError({ uid: 'a', token: { auth_time: 999 } }, 'delete', 1000), 'confirmation-required');
  assert.equal(deletionRequestError({ uid: 'a', token: { auth_time: 999 } }, 'DELETE', 1000), null);
});
test('shared records retain answers and other people’s attribution while anonymizing the deleted account and history', () => {
  const source = { submittedBy: 'a', submittedByName: 'Alice', tithe: 100, values: { children: 5, note: 'Church record' }, history: [{ userId: 'a', userName: 'Alice' }, { editedBy: 'b', editorName: 'Bob' }], treasurerId: 'a', treasurerName: 'Alice' };
  const result = anonymizeAttribution(source, 'a', 'deleted_random');
  assert.equal(result.submittedBy, 'deleted_random'); assert.equal(result.submittedByName, 'Deleted user');
  assert.equal(result.history[0].userName, 'Deleted user'); assert.equal(result.history[1].editorName, 'Bob');
  assert.deepEqual(result.values, source.values); assert.equal(result.tithe, 100);
  assert.equal(result.treasurerId, ''); assert.equal(source.submittedByName, 'Alice');
  assert.deepEqual(anonymizeAttribution(result, 'a', 'deleted_random'), result);
});
