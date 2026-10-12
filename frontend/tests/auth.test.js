/** Verify exact credentials and registration persistence including partial failures. */
import { it, expect, vi } from 'vitest';
import { login, register } from '../src/lib/auth.js';
import { readUsers, readSession, writeUsers, writeSession, STORAGE_KEYS } from '../src/lib/storage.js';
import { DEFAULT_ADMIN } from '../src/lib/permissions.js';
const input = { displayName: ' Writer ', username: ' Writer1 ', password: ' demo ', confirmPassword: ' demo ', role: 'admin' };
const existing = { id: 'old', username: 'existing', displayName: 'Existing', password: 'exact ', role: 'user', createdAt: '2026-01-01' };

it('persists fixed Admin session without materializing a user row', () => {
  expect(login({ username: 'admin', password: 'admin' })).toEqual({ ok: true, value: DEFAULT_ADMIN });
  expect(readSession()).toEqual(DEFAULT_ADMIN); expect(readUsers()).toEqual([]);
});
it.each(['admin', 'user'])('persists stored %s session without password', (role) => {
  writeUsers([{ ...existing, role }]);
  const result = login({ username: 'existing', password: 'exact ' });
  expect(result).toEqual({ ok: true, value: { userId: 'old', username: 'existing', displayName: 'Existing', role } });
  expect(readSession()).toEqual(result.value); expect(result.value).not.toHaveProperty('password');
});
it.each([undefined, null, {}, { username: 'admin', password: '' }, { username: 'Admin', password: 'admin' }, { username: 'admin', password: 'wrong' }, { username: ' admin ', password: 'admin' }, { username: 'existing', password: 'exact' }, { username: 'Existing', password: 'exact ' }])('rejects invalid/exact mismatch %j without changing session', (credentials) => {
  writeUsers([existing]); writeSession(DEFAULT_ADMIN);
  expect(login(credentials)).toEqual({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } });
  expect(readSession()).toEqual(DEFAULT_ADMIN);
});
it('rejects a stored malformed role instead of establishing session', () => {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([{ ...existing, role: 'Admin' }]));
  expect(login({ username: 'existing', password: 'exact ' }).ok).toBe(false); expect(readSession()).toBeNull();
});
it('reports login session-write failure with old session unchanged', () => {
  writeSession(DEFAULT_ADMIN); writeUsers([existing]);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private'); });
  expect(login({ username: 'existing', password: 'exact ' })).toMatchObject({ ok: false, error: { code: 'STORAGE_WRITE_FAILED' } });
  expect(readSession()).toEqual(DEFAULT_ADMIN);
});
it('registers trimmed identity, exact password, UUID/date and user-only role', () => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-id');
  writeUsers([existing]);
  const result = register(input);
  expect(result).toEqual({ ok: true, value: { userId: 'new-id', username: 'Writer1', displayName: 'Writer', role: 'user' } });
  const users = readUsers();
  expect(users[0]).toEqual(existing);
  expect(users[1]).toEqual({ id: 'new-id', username: 'Writer1', displayName: 'Writer', password: ' demo ', role: 'user', createdAt: expect.any(String) });
  expect(Number.isNaN(Date.parse(users[1].createdAt))).toBe(false);
  expect(readSession()).toEqual(result.value);
});
it.each([
  [{ ...input, username: ' ADMIN ' }, 'USERNAME_RESERVED', 'username'],
  [{ ...input, username: ' EXISTING ' }, 'USERNAME_DUPLICATE', 'username'],
  [{ ...input, confirmPassword: 'different' }, 'VALIDATION_FAILED', 'confirmPassword'],
  [{ ...input, displayName: '' }, 'VALIDATION_FAILED', 'displayName'],
  [{ ...input, username: '' }, 'VALIDATION_FAILED', 'username'],
  [{ ...input, password: '' }, 'VALIDATION_FAILED', 'password'],
  [{ ...input, confirmPassword: '' }, 'VALIDATION_FAILED', 'confirmPassword'],
])('rejects %j before any account/session persistence', (fields, code, field) => {
  writeUsers([existing]);
  expect(register(fields)).toMatchObject({ ok: false, error: { code, field } });
  expect(readUsers()).toEqual([existing]); expect(readSession()).toBeNull();
});
it('handles absent registration input', () => { expect(register().ok).toBe(false); expect(register(null).ok).toBe(false); expect(readUsers()).toEqual([]); });
it('preserves old users when the account write fails', () => {
  writeUsers([existing]);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private'); });
  expect(register(input)).toMatchObject({ ok: false, error: { code: 'STORAGE_WRITE_FAILED' } });
  expect(readUsers()).toEqual([existing]); expect(readSession()).toBeNull();
});
it('retains saved account on session failure and permits retry login', () => {
  const original = Storage.prototype.setItem;
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === STORAGE_KEYS.session) throw new Error('private');
    original.call(this, key, value);
  });
  expect(register(input)).toMatchObject({ ok: false, error: { code: 'SESSION_WRITE_FAILED', message: expect.stringContaining('retry login') } });
  expect(readUsers()).toHaveLength(1); expect(readSession()).toBeNull();
  spy.mockRestore();
  expect(login({ username: 'Writer1', password: ' demo ' }).ok).toBe(true);
  expect(readSession().role).toBe('user');
});
