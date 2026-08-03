import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ORGANIZE_LOCK_KEY,
  acquireOrganizeLock,
  isOrganizeLocked,
  isUndoSnapshotActive,
  releaseOrganizeLock,
  stampUndoSnapshot,
} from '../src/state.js';

function makeStorage(initial = {}) {
  const values = { ...initial };
  return {
    values,
    async get(keys) {
      const requested = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(requested.filter((key) => key in values).map((key) => [key, values[key]]));
    },
    async set(changes) {
      Object.assign(values, changes);
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    },
  };
}

test('allows only one same-tick browser mutation operation', async () => {
  const storage = makeStorage();
  const first = acquireOrganizeLock(storage, { now: 1_000, token: 'first' });

  await assert.rejects(
    acquireOrganizeLock(storage, { now: 1_000, token: 'second' }),
    (error) => error.code === 'BUSY',
  );

  const token = await first;
  assert.equal(token, 'first');
  assert.equal(await isOrganizeLocked(storage, { now: 1_001 }), true);
  await releaseOrganizeLock(storage, token);
  assert.equal(await isOrganizeLocked(storage, { now: 1_001 }), false);
});

test('rejects a live persisted lock and replaces an expired lock', async () => {
  const storage = makeStorage({
    [ORGANIZE_LOCK_KEY]: { token: 'old', startedAt: 1_000, expiresAt: 2_000 },
  });

  await assert.rejects(
    acquireOrganizeLock(storage, { now: 1_500, token: 'blocked' }),
    (error) => error.code === 'BUSY',
  );

  const token = await acquireOrganizeLock(storage, { now: 2_000, token: 'replacement' });
  assert.equal(storage.values[ORGANIZE_LOCK_KEY].token, 'replacement');
  await releaseOrganizeLock(storage, token);
});

test('expires undo snapshots at the exact thirty-minute boundary', () => {
  const snapshot = stampUndoSnapshot({ windowId: 9 }, { now: 10_000 });
  assert.equal(snapshot.createdAt, 10_000);
  assert.equal(snapshot.expiresAt, 1_810_000);
  assert.equal(isUndoSnapshotActive(snapshot, { now: 1_809_999 }), true);
  assert.equal(isUndoSnapshotActive(snapshot, { now: 1_810_000 }), false);
  assert.equal(isUndoSnapshotActive({ windowId: 9 }, { now: 10_000 }), false);
});
