/** Exercise role, ownership, fixed account and self-delete boundaries. */
import { it, expect } from 'vitest';
import { DEFAULT_ADMIN, roleHome, resolveAccess, canManagePost, canDeleteUser, isDefaultAdmin } from '../src/lib/permissions.js';
const member = { userId: 'u1', username: 'writer', displayName: 'Writer', role: 'user' };
const manager = { ...member, role: 'admin' };

it.each([[DEFAULT_ADMIN, '/admin'], [member, '/blogs'], [null, '/blogs'], [{ role: 'Admin' }, '/blogs']])('chooses canonical role home for %j', (session, home) => {
  expect(roleHome(session)).toBe(home);
});
it.each([null, {}, { ...member, role: 'invalid' }])('rejects invalid/guest session before Admin guard %j', (session) => {
  expect(resolveAccess(session, 'admin')).toEqual({ allow: false, redirect: '/login' });
});
it('allows both canonical roles on general routes and only required role', () => {
  expect(resolveAccess(member)).toEqual({ allow: true });
  expect(resolveAccess(manager)).toEqual({ allow: true });
  expect(resolveAccess(manager, 'admin')).toEqual({ allow: true });
  expect(resolveAccess(member, 'admin')).toEqual({ allow: false, redirect: '/blogs' });
  expect(resolveAccess(manager, 'user')).toEqual({ allow: false, redirect: '/admin' });
});
it.each([
  [member, { authorId: 'u1' }, true], [member, { authorId: 'other' }, false],
  [manager, { authorId: 'other' }, true], [null, { authorId: 'u1' }, false],
  [member, null, false], [{ ...member, role: 'Admin' }, { authorId: 'u1' }, false],
])('checks post mutation for %j %j', (session, post, allowed) => { expect(canManagePost(session, post)).toBe(allowed); });
it.each([
  [null, false], [{ id: 'admin', username: 'other' }, true], [{ id: 'other', username: ' ADMIN ' }, true],
  [{ id: 'other', username: 'writer' }, false], [{ id: 'other', username: 3 }, false],
])('recognizes fixed account %j', (target, expected) => { expect(isDefaultAdmin(target)).toBe(expected); });
it.each([
  [manager, { id: 'other', username: 'other' }, true], [member, { id: 'other' }, false],
  [null, { id: 'other' }, false], [manager, null, false], [manager, {}, false],
  [manager, { id: 'u1' }, false], [manager, { id: 'admin' }, false],
  [manager, { id: 'other', username: 'AdMiN' }, false], [{ ...manager, role: 'Admin' }, { id: 'other' }, false],
])('checks managed account deletion %j %j', (session, target, expected) => { expect(canDeleteUser(session, target)).toBe(expected); });
