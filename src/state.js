import { OrganizerError } from './errors.js';

export const ORGANIZE_LOCK_KEY = 'activeOrganizeOperation';
export const ORGANIZE_LOCK_TTL_MS = 60_000;
export const UNDO_TTL_MS = 30 * 60_000;

let inMemoryLockToken = null;

function makeToken() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isUnexpired(lock, now) {
  return Boolean(lock && typeof lock.token === 'string' && Number.isFinite(lock.expiresAt) && lock.expiresAt > now);
}

export async function acquireOrganizeLock(storage, {
  now = Date.now(),
  ttlMs = ORGANIZE_LOCK_TTL_MS,
  token = makeToken(),
} = {}) {
  if (inMemoryLockToken) {
    throw new OrganizerError('BUSY', '正在整理，请稍候。');
  }

  inMemoryLockToken = token;
  try {
    const values = await storage.get(ORGANIZE_LOCK_KEY);
    if (isUnexpired(values[ORGANIZE_LOCK_KEY], now)) {
      throw new OrganizerError('BUSY', '正在整理，请稍候。');
    }

    await storage.set({
      [ORGANIZE_LOCK_KEY]: {
        token,
        startedAt: now,
        expiresAt: now + ttlMs,
      },
    });
    return token;
  } catch (error) {
    if (inMemoryLockToken === token) inMemoryLockToken = null;
    throw error;
  }
}

export async function releaseOrganizeLock(storage, token) {
  try {
    const values = await storage.get(ORGANIZE_LOCK_KEY);
    if (values[ORGANIZE_LOCK_KEY]?.token === token) {
      await storage.remove(ORGANIZE_LOCK_KEY);
    }
  } finally {
    if (inMemoryLockToken === token) inMemoryLockToken = null;
  }
}

export async function isOrganizeLocked(storage, { now = Date.now() } = {}) {
  if (inMemoryLockToken) return true;

  const values = await storage.get(ORGANIZE_LOCK_KEY);
  const lock = values[ORGANIZE_LOCK_KEY];
  if (isUnexpired(lock, now)) return true;
  if (lock) await storage.remove(ORGANIZE_LOCK_KEY);
  return false;
}

export function stampUndoSnapshot(snapshot, { now = Date.now(), ttlMs = UNDO_TTL_MS } = {}) {
  return {
    ...snapshot,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
}

export function isUndoSnapshotActive(snapshot, { now = Date.now() } = {}) {
  return Boolean(snapshot && Number.isFinite(snapshot.expiresAt) && snapshot.expiresAt > now);
}
