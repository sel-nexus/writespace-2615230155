/** Establish browser-local demonstration identities only after durable writes. */
import { readUsers, writeUsers, writeSession } from './storage.js';
import { DEFAULT_ADMIN } from './permissions.js';
import { validateLogin, validateRegistration } from './validation.js';

/** Strip credentials and account metadata from a session.
 * Args: user (object): managed account.
 * Returns: {object} Minimal canonical session.
 */
function sessionFor(user) {
  return { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

/** Resolve exact fixed or stored credentials and persist the session.
 * @param {object} [input] Exact username and password input.
 * @returns {object} Session success or typed invalid/storage failure.
 */
export function login(input = {}) {
  if (Object.keys(validateLogin(input)).length) return { ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } };
  let session;
  if (input.username === 'admin' && input.password === 'admin') session = { ...DEFAULT_ADMIN };
  else {
    const user = readUsers().find((candidate) => candidate.username === input.username && candidate.password === input.password);
    if (!user) return { ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } };
    session = sessionFor(user);
  }
  const result = writeSession(session);
  return result.ok ? { ok: true, value: session } : result;
}

/** Register only an ordinary user and explain non-atomic session failure.
 * @param {object} [input] Display name, username, password and confirmation.
 * @returns {object} Session success or typed validation/persistence failure.
 * Notes: An account remains stored when the subsequent session write fails.
 */
export function register(input = {}) {
  const users = readUsers();
  const errors = validateRegistration(input, users);
  const field = Object.keys(errors)[0];
  if (field) {
    const code = errors[field] === 'Username admin is reserved.' ? 'USERNAME_RESERVED' :
      errors[field] === 'Username is already taken.' ? 'USERNAME_DUPLICATE' : 'VALIDATION_FAILED';
    return { ok: false, error: { code, field, message: errors[field], fields: errors } };
  }
  const user = {
    id: crypto.randomUUID(),
    displayName: input.displayName.trim(),
    username: input.username.trim(),
    password: input.password,
    role: 'user',
    createdAt: new Date().toISOString(),
  };
  const accountResult = writeUsers([...users, user]);
  if (!accountResult.ok) return accountResult;
  const session = sessionFor(user);
  const sessionResult = writeSession(session);
  if (!sessionResult.ok) return { ok: false, error: { code: 'SESSION_WRITE_FAILED', message: 'Your account was saved, but registration was not completed. Please retry login to sign in.' } };
  return { ok: true, value: session };
}
