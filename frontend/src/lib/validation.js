/** Validate form fields without inventing length or password-complexity policies. */

/** Normalize identity comparisons only; passwords remain untouched.
 * @param {unknown} value Username candidate.
 * @returns {string} Trimmed locale-lowercase identity or empty string.
 */
export function normalizeUsername(value) { return typeof value === 'string' ? value.trim().toLocaleLowerCase() : ''; }

/** Check required text with optional whitespace preservation.
 * Args: value (unknown), trim (boolean): whether whitespace alone is empty.
 * Returns: {boolean} Whether input is present.
 */
function present(value, trim = true) { return typeof value === 'string' && (trim ? value.trim() : value).length > 0; }

/** Validate login required fields without changing exact credentials.
 * @param {object} [input] Submitted values.
 * @returns {object} Field errors, empty when valid.
 */
export function validateLogin(input = {}) {
  const errors = {};
  if (!present(input?.username)) errors.username = 'Username is required.';
  if (!present(input?.password, false)) errors.password = 'Password is required.';
  return errors;
}

/** Validate fields shared by registration and managed creation.
 * Args: input (object), users (Array): submitted values and existing accounts.
 * Returns: {object} Field-level required, reserved or duplicate errors.
 */
function validateAccount(input, users) {
  const errors = validateLogin(input);
  if (!present(input?.displayName)) errors.displayName = 'Display name is required.';
  const username = normalizeUsername(input?.username);
  if (username === 'admin') errors.username = 'Username admin is reserved.';
  else if (username && Array.isArray(users) && users.some((user) => normalizeUsername(user?.username) === username)) {
    errors.username = 'Username is already taken.';
  }
  return errors;
}

/** Validate registration fields while ignoring any submitted role.
 * @param {object} [input] Submitted values.
 * @param {Array} [users] Existing managed accounts.
 * @returns {object} Field errors, empty when valid.
 */
export function validateRegistration(input = {}, users = []) {
  const errors = validateAccount(input, users);
  if (!present(input?.confirmPassword, false)) errors.confirmPassword = 'Confirm password is required.';
  else if (input?.password !== input.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

/** Validate Admin-managed creation including canonical role literals.
 * @param {object} [input] Submitted values.
 * @param {Array} [users] Existing managed accounts.
 * @returns {object} Field errors, empty when valid.
 */
export function validateManagedUser(input = {}, users = []) {
  const errors = validateAccount(input, users);
  if (input?.role !== 'admin' && input?.role !== 'user') errors.role = 'Choose Admin or user.';
  return errors;
}

/** Validate non-whitespace title and content without transforming plain text.
 * @param {object} [input] Submitted title and content.
 * @returns {object} Field errors, empty when valid.
 */
export function validatePost(input = {}) {
  const errors = {};
  if (!present(input?.title)) errors.title = 'Title is required.';
  if (!present(input?.content)) errors.content = 'Content is required.';
  return errors;
}
