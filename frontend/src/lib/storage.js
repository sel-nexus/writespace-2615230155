/** Read browser-local records defensively and report persistence failures. */
export const STORAGE_KEYS = {
  posts: 'writespace_posts',
  users: 'writespace_users',
  session: 'writespace_session',
};

/** Check required string fields on a non-array record.
 * Args: value (unknown), fields (string[]): required primitive fields.
 * Returns: {boolean} Whether the structural contract holds.
 */
function hasStrings(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    fields.every((field) => typeof value[field] === 'string');
}

/** Check a canonical demo role.
 * Args: role (unknown): candidate role.
 * Returns: {boolean} Whether the role is supported.
 */
function validRole(role) {
  return role === 'admin' || role === 'user';
}

/** Check a post's primitive fields without claiming semantic validity.
 * @param {unknown} value Candidate record.
 * @returns {boolean} Structural validity.
 */
export function isPost(value) {
  return hasStrings(value, ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName']);
}

/** Check a stored account's primitive fields and role.
 * @param {unknown} value Candidate record.
 * @returns {boolean} Structural validity.
 */
export function isUser(value) {
  return hasStrings(value, ['id', 'displayName', 'username', 'password', 'createdAt']) && validRole(value.role);
}

/** Accept only a complete canonical session, never an array.
 * @param {unknown} value Candidate session.
 * @returns {boolean} Structural validity, not trusted authorization.
 */
export function isSession(value) {
  return hasStrings(value, ['userId', 'username', 'displayName']) && validRole(value.role);
}

/** Parse a key with a safe fallback on inaccessible or malformed storage.
 * Args: key (string): browser-local storage key.
 * Returns: {unknown|null} Parsed data or null; never raises.
 */
function read(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

/** Read and filter a collection without repairing the source key.
 * Args: key (string), predicate (Function): structural row validator.
 * Returns: {Array} Valid records or a safe empty collection.
 */
function readCollection(key, predicate) {
  const value = read(key);
  return Array.isArray(value) ? value.filter(predicate) : [];
}

/** Read structurally valid local posts.
 * @returns {Array} Valid posts; empty on failed reads.
 */
export function readPosts() { return readCollection(STORAGE_KEYS.posts, isPost); }

/** Read structurally valid managed accounts.
 * @returns {Array} Valid accounts; empty on failed reads.
 */
export function readUsers() { return readCollection(STORAGE_KEYS.users, isUser); }

/** Restore a complete session or fail closed.
 * @returns {object|null} Session or null on invalid/inaccessible data.
 */
export function readSession() {
  const value = read(STORAGE_KEYS.session);
  return isSession(value) ? value : null;
}

/** Persist a validated value without exposing browser exception details.
 * Args: key (string), value (unknown), valid (boolean): serialization contract.
 * Returns: {object} Typed success with null or a non-success error.
 */
function write(key, value, valid) {
  if (!valid) return { ok: false, error: { code: 'INVALID_STORAGE_VALUE', message: 'The local record has an invalid shape.' } };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true, value: null };
  } catch {
    return { ok: false, error: { code: 'STORAGE_WRITE_FAILED', message: 'Changes could not be saved in this browser.' } };
  }
}

/** Replace local posts after structural validation.
 * @param {Array} posts Complete replacement array.
 * @returns {object} Typed persistence outcome.
 */
export function writePosts(posts) {
  return write(STORAGE_KEYS.posts, posts, Array.isArray(posts) && posts.every(isPost));
}

/** Replace managed accounts after structural validation.
 * @param {Array} users Complete replacement array.
 * @returns {object} Typed persistence outcome.
 */
export function writeUsers(users) {
  return write(STORAGE_KEYS.users, users, Array.isArray(users) && users.every(isUser));
}

/** Persist a complete session before routing.
 * @param {object} session Canonical session.
 * @returns {object} Typed persistence outcome.
 */
export function writeSession(session) { return write(STORAGE_KEYS.session, session, isSession(session)); }

/** Remove only the session, preserving accounts and posts.
 * @returns {object} Typed removal outcome; never raises.
 */
export function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEYS.session);
    return { ok: true, value: null };
  } catch {
    return { ok: false, error: { code: 'STORAGE_WRITE_FAILED', message: 'Logout could not be saved in this browser. Please retry.' } };
  }
}
