/** Derive stable dates and bounded views without mutating stored collections. */

/** Format a local calendar date with fixed English month/day/year copy.
 * @param {string} value Date string.
 * @returns {string} MMM DD, YYYY or readable invalid-date fallback.
 */
export function formatDate(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return `${date.toLocaleString('en-US', { month: 'short' })} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
}

/** Convert malformed timestamps to oldest position.
 * Args: post (object): record with createdAt.
 * Returns: {number} Timestamp or negative infinity.
 */
function timestamp(post) {
  const value = Date.parse(post?.createdAt);
  return Number.isNaN(value) ? -Infinity : value;
}

/** Copy, sort newest first, and optionally bound a view.
 * @param {Array} posts Source collection.
 * @param {number} [limit=Infinity] Nonnegative integer bound, Infinity for all.
 * @returns {Array} Stable newest-first view; invalid bounds produce empty views.
 */
export function newestPosts(posts, limit = Infinity) {
  if (!Array.isArray(posts) || (limit !== Infinity && (!Number.isInteger(limit) || limit < 0))) return [];
  return [...posts].sort((a, b) => {
    const left = timestamp(a);
    const right = timestamp(b);
    return left === right ? 0 : right > left ? 1 : -1;
  }).slice(0, limit);
}

/** Return the exact first characters of plain text, without adding ellipsis.
 * @param {unknown} content Plain text candidate.
 * @param {number} [limit=120] Nonnegative integer length.
 * @returns {string} Bounded excerpt, empty for invalid input.
 */
export function excerpt(content, limit = 120) {
  return typeof content === 'string' && Number.isInteger(limit) && limit >= 0 ? content.slice(0, limit) : '';
}
