import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveWithOptionalAudit } from '../../src/lib/auditedSave';
import { unionSaveError } from '../../src/lib/saveErrors';

test('a denied Union write rejects before any audit or success handling', async () => {
  let auditCalls = 0;
  const error = Object.assign(new Error('Denied'), { code: 'permission-denied' });
  await assert.rejects(saveWithOptionalAudit(
    async () => { throw error; },
    async () => { auditCalls++; },
  ), error);
  assert.equal(auditCalls, 0);
  assert.match(unionSaveError(error), /Firebase denied this save/);
  assert.match(unionSaveError(error), /entries have been kept/);
});

test('a failed audit preserves a successful Union save without retrying the write', async () => {
  let writes = 0;
  const auditError = new Error('Audit denied');
  const result = await saveWithOptionalAudit(
    async () => { writes++; return 'new-union'; },
    async () => { throw auditError; },
  );
  assert.equal(result.saved, 'new-union');
  assert.equal((await result.auditResult).error, auditError);
  assert.equal(writes, 1);
});

test('a delayed audit does not keep a successful Union save pending', async () => {
  let finish!: () => void;
  const auditPending = new Promise<void>((resolve) => { finish = resolve; });
  const result = await saveWithOptionalAudit(async () => 'union', () => auditPending);
  assert.equal(result.saved, 'union');
  finish();
  assert.deepEqual(await result.auditResult, {});
});
