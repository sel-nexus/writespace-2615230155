/** Verify safe reads, structural filtering, and typed persistence outcomes. */
import { describe, it, expect, vi } from 'vitest';
import { STORAGE_KEYS, readPosts, readUsers, readSession, writePosts, writeUsers, writeSession, clearSession, isPost, isUser, isSession } from '../src/lib/storage.js';

const post = { id: 'p1', title: 'Title', content: 'Text', createdAt: '2026-01-01', authorId: 'u1', authorName: 'Writer' };
const user = { id: 'u1', displayName: 'Writer', username: 'writer', password: 'demo', role: 'user', createdAt: '2026-01-01' };
const session = { userId: 'u1', username: 'writer', displayName: 'Writer', role: 'user' };

describe.each([
  ['posts', readPosts, writePosts, post, isPost],
  ['users', readUsers, writeUsers, user, isUser],
])('%s collection', (key, read, write, row, valid) => {
  it('returns empty when missing', () => { expect(read()).toEqual([]); });
  it.each(['{', '{}', 'null', '"text"', '12'])('returns empty for malformed/non-array %s', (raw) => {
    localStorage.setItem(STORAGE_KEYS[key], raw);
    expect(read()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS[key])).toBe(raw);
  });
  it('filters malformed rows without rewriting source', () => {
    const raw = JSON.stringify([row, null, 1, [], {}, { ...row, id: 3 }]);
    localStorage.setItem(STORAGE_KEYS[key], raw);
    expect(read()).toEqual([row]);
    expect(localStorage.getItem(STORAGE_KEYS[key])).toBe(raw);
  });
  it('falls back on thrown getItem', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private'); });
    expect(read()).toEqual([]);
  });
  it('falls back when the storage getter is inaccessible', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('private'); });
    expect(read()).toEqual([]);
  });
  it('writes and rereads valid records and empty arrays', () => {
    expect(write([row])).toEqual({ ok: true, value: null });
    expect(read()).toEqual([row]);
    expect(write([])).toEqual({ ok: true, value: null });
    expect(read()).toEqual([]);
  });
  it.each([null, {}, [null], [42]])('rejects invalid input without replacing stored data %j', (input) => {
    write([row]);
    expect(write(input)).toMatchObject({ ok: false, error: { code: 'INVALID_STORAGE_VALUE' } });
    expect(read()).toEqual([row]);
  });
  it('preserves records on setItem exception and hides raw details', () => {
    write([row]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private'); });
    expect(write([])).toEqual({ ok: false, error: { code: 'STORAGE_WRITE_FAILED', message: 'Changes could not be saved in this browser.' } });
    expect(read()).toEqual([row]);
  });
  it.each(Object.keys(row))('rejects a wrong primitive type for %s', (field) => {
    expect(valid({ ...row, [field]: 99 })).toBe(false);
    const missing = { ...row }; delete missing[field];
    expect(valid(missing)).toBe(false);
  });
});

describe('session persistence', () => {
  it('restores canonical user and Admin sessions', () => {
    for (const role of ['user', 'admin']) {
      expect(writeSession({ ...session, role })).toEqual({ ok: true, value: null });
      expect(readSession()).toEqual({ ...session, role });
    }
  });
  it.each([null, [], {}, { ...session, role: 'Admin' }, { ...session, userId: 1 }])('fails closed on %j', (input) => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(input));
    expect(readSession()).toBeNull();
    expect(isSession(input)).toBe(false);
    expect(writeSession(input).ok).toBe(false);
  });
  it.each(Object.keys(session))('rejects missing session field %s', (field) => {
    const value = { ...session }; delete value[field];
    expect(isSession(value)).toBe(false);
  });
  it('returns null for missing, malformed and inaccessible session', () => {
    expect(readSession()).toBeNull();
    localStorage.setItem(STORAGE_KEYS.session, '{');
    expect(readSession()).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private'); });
    expect(readSession()).toBeNull();
  });
  it('reports session write failure without overwriting old session', () => {
    writeSession(session);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private'); });
    expect(writeSession({ ...session, role: 'admin' }).ok).toBe(false);
    expect(readSession()).toEqual(session);
  });
  it('clears session idempotently and preserves users/posts', () => {
    writeSession(session); writeUsers([user]); writePosts([post]);
    expect(clearSession()).toEqual({ ok: true, value: null });
    expect(clearSession()).toEqual({ ok: true, value: null });
    expect(readSession()).toBeNull();
    expect(readUsers()).toEqual([user]); expect(readPosts()).toEqual([post]);
  });
  it('preserves identity when removal throws', () => {
    writeSession(session);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('private'); });
    expect(clearSession()).toMatchObject({ ok: false, error: { code: 'STORAGE_WRITE_FAILED' } });
    expect(readSession()).toEqual(session);
  });
});
