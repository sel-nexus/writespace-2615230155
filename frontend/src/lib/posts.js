/** Mutate browser-local posts with fresh reads and repeated permission checks. */
import { isSession, readPosts, writePosts } from "./storage.js";
import { canManagePost } from "./permissions.js";
import { validatePost } from "./validation.js";

/** Build a non-success result without leaking browser exception details.
 * Args: code, message, field: stable error description and optional invalid field.
 * Returns: {object} Typed failure.
 */
function failure(code, message, field) {
  return { ok: false, error: { code, message, ...(field ? { field } : {}) } };
}

/** Return the first field error while leaving submitted text untouched.
 * Args: fields (unknown): submitted title and content.
 * Returns: {object|null} Validation failure or null.
 */
function invalidFields(fields) {
  const errors = validatePost(fields);
  const field = Object.keys(errors)[0];
  return field ? failure("VALIDATION_FAILED", errors[field], field) : null;
}

/** Append a post only after validation and successful persistence.
 * @param {object} fields Required title and plain-text content.
 * @param {object|null} session Active rendered identity, not trusted authorization.
 * @returns {object} Persisted post or typed validation, identity, metadata or write failure.
 * Notes: Read the latest collection; do not cache it or trim user text.
 */
export function createPost(fields, session) {
  const invalid = invalidFields(fields);
  if (invalid) return invalid;
  if (!isSession(session))
    return failure("FORBIDDEN", "Sign in to manage posts.");
  let post;
  try {
    post = {
      id: crypto.randomUUID(),
      title: fields.title,
      content: fields.content,
      createdAt: new Date().toISOString(),
      authorId: session.userId,
      authorName: session.displayName,
    };
  } catch {
    return failure(
      "POST_CREATION_FAILED",
      "Post could not be created in this browser."
    );
  }
  const result = writePosts([...readPosts(), post]);
  return result.ok
    ? { ok: true, value: post }
    : failure(result.error.code, "Post could not be saved in this browser.");
}

/** Update only title and content on the latest permitted target.
 * @param {string} postId Exact stored ID.
 * @param {object} fields Required title and content.
 * @param {object|null} session Active rendered identity.
 * @returns {object} Persisted post or typed validation, missing, forbidden or write failure.
 */
export function updatePost(postId, fields, session) {
  const invalid = invalidFields(fields);
  if (invalid) return invalid;
  const posts = readPosts();
  const post =
    typeof postId === "string"
      ? posts.find((candidate) => candidate.id === postId)
      : null;
  if (!post)
    return failure("TARGET_NOT_FOUND", "The selected record no longer exists.");
  if (!canManagePost(session, post))
    return failure("FORBIDDEN", "You cannot manage this post.");
  const updated = { ...post, title: fields.title, content: fields.content };
  const result = writePosts(
    posts.map((candidate) => (candidate.id === postId ? updated : candidate))
  );
  return result.ok
    ? { ok: true, value: updated }
    : failure(result.error.code, "Post could not be saved in this browser.");
}

/** Delete the latest permitted target after the caller confirms.
 * @param {string} postId Exact stored ID.
 * @param {object|null} session Active rendered identity.
 * @returns {object} Null success or typed missing, forbidden or persistence failure.
 * Notes: Confirmation belongs to the UI; this function repeats ownership checks.
 */
export function deletePost(postId, session) {
  const posts = readPosts();
  const post =
    typeof postId === "string"
      ? posts.find((candidate) => candidate.id === postId)
      : null;
  if (!post)
    return failure("TARGET_NOT_FOUND", "The selected record no longer exists.");
  if (!canManagePost(session, post))
    return failure("FORBIDDEN", "You cannot manage this post.");
  return writePosts(posts.filter((candidate) => candidate.id !== postId));
}
