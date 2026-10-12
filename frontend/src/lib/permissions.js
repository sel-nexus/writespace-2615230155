/** Centralize demo route and mutation usability rules, not trusted security. */
import { isSession } from './storage.js';

export const DEFAULT_ADMIN = Object.freeze({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });

/** Choose the signed-in role destination.
 * @param {object|null} session Active identity.
 * @returns {string} Admin home only for canonical admin, otherwise blogs.
 */
export function roleHome(session) { return session?.role === 'admin' ? '/admin' : '/blogs'; }

/** Apply guest checks before required-role checks.
 * @param {object|null} session Active identity.
 * @param {string} [requiredRole] Optional canonical role restriction.
 * @returns {object} Allow result or deterministic redirect.
 */
export function resolveAccess(session, requiredRole) {
  if (!isSession(session)) return { allow: false, redirect: '/login' };
  if (requiredRole && session.role !== requiredRole) return { allow: false, redirect: roleHome(session) };
  return { allow: true };
}

/** Permit Admin or the owning ordinary user to mutate an existing post.
 * @param {object|null} session Active identity.
 * @param {object|null} post Existing target.
 * @returns {boolean} Whether mutation is permitted locally.
 */
export function canManagePost(session, post) {
  return isSession(session) && Boolean(post) &&
    (session.role === 'admin' || post.authorId === session.userId);
}

/** Identify the fixed account by canonical ID or normalized reserved username.
 * @param {object|null} target Account candidate.
 * @returns {boolean} Whether the account represents the fixed identity.
 */
export function isDefaultAdmin(target) {
  return Boolean(target) && (target.id === DEFAULT_ADMIN.userId ||
    (typeof target.username === 'string' && target.username.trim().toLocaleLowerCase() === 'admin'));
}

/** Reject guest, non-Admin, missing, fixed and self account deletion.
 * @param {object|null} session Active identity.
 * @param {object|null} target Existing managed account.
 * @returns {boolean} Whether deletion is permitted locally.
 */
export function canDeleteUser(session, target) {
  return isSession(session) && session.role === 'admin' && Boolean(target) &&
    typeof target.id === 'string' && !isDefaultAdmin(target) && target.id !== session.userId;
}
