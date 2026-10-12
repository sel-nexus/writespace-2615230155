/** Manage browser-local accounts without claiming trusted authorization. */
import { isSession, readUsers, writeUsers } from "./storage.js";
import { DEFAULT_ADMIN, isDefaultAdmin, canDeleteUser } from "./permissions.js";
import { validateManagedUser } from "./validation.js";

/** Display the fixed identity exactly once without persisting synthetic data.
 * @param {Array} users Structurally valid managed accounts.
 * @returns {Array} Managed accounts plus one canonical fixed Admin.
 * Notes: Discard stored aliases of the reserved fixed identity from this view only.
 */
export function accountRows(users = readUsers()) {
  return [
    {
      id: DEFAULT_ADMIN.userId,
      username: DEFAULT_ADMIN.username,
      displayName: DEFAULT_ADMIN.displayName,
      role: "admin",
      createdAt: "",
    },
    ...users.filter((user) => !isDefaultAdmin(user)),
  ];
}

/** Count aggregate and role accounts with the fixed Admin included once.
 * @param {Array} users Structurally valid stored accounts.
 * @returns {object} Total users, Admins and ordinary users.
 */
export function countUsers(users = readUsers()) {
  const rows = accountRows(users);
  return {
    totalUsers: rows.length,
    totalAdmins: rows.filter((user) => user.role === "admin").length,
    totalMembers: rows.filter((user) => user.role === "user").length,
  };
}

/** Return a stable non-success result.
 * Args: code, message: public failure description.
 * Returns: {object} Typed error result.
 */
function failure(code, message) {
  return { ok: false, error: { code, message } };
}

/** Create a validated managed account for an active canonical Admin only.
 * @param {object} input Required display name, username, exact password and role.
 * @param {object|null} session Active rendered identity.
 * @returns {object} Persisted user or validation, permission, metadata or write error.
 * Notes: Re-read accounts for uniqueness; never establish or change the session.
 */
export function createManagedUser(input, session) {
  if (!isSession(session) || session.role !== "admin") {
    return failure("FORBIDDEN", "Only Admin can manage accounts.");
  }
  const users = readUsers();
  const fields = validateManagedUser(input, users);
  const field = Object.keys(fields)[0];
  if (field) {
    const code =
      fields[field] === "Username admin is reserved."
        ? "USERNAME_RESERVED"
        : fields[field] === "Username is already taken."
        ? "USERNAME_DUPLICATE"
        : "VALIDATION_FAILED";
    return {
      ok: false,
      error: { code, field, fields, message: fields[field] },
    };
  }
  let user;
  try {
    user = {
      id: crypto.randomUUID(),
      displayName: input.displayName.trim(),
      username: input.username.trim(),
      password: input.password,
      role: input.role,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return failure(
      "USER_CREATION_FAILED",
      "Account could not be created in this browser."
    );
  }
  const result = writeUsers([...users, user]);
  return result.ok ? { ok: true, value: user } : result;
}

/** Delete a fresh eligible account only after explicit confirmation.
 * @param {string} targetUserId Stored ID, never a username.
 * @param {object|null} session Active Admin identity.
 * @param {boolean} confirmed Strict true after the caller confirms.
 * @returns {object} Null success or forbidden, missing, canceled or write failure.
 * Notes: Protect default and self identities again after the confirmation dialog.
 */
export function deleteManagedUser(targetUserId, session, confirmed = false) {
  if (!isSession(session) || session.role !== "admin") {
    return failure("FORBIDDEN", "Only Admin can manage accounts.");
  }
  const users = readUsers();
  const target =
    typeof targetUserId === "string"
      ? users.find((user) => user.id === targetUserId) ||
        accountRows(users).find((user) => user.id === targetUserId)
      : null;
  if (!target)
    return failure("TARGET_NOT_FOUND", "The selected record no longer exists.");
  if (!canDeleteUser(session, target)) {
    return failure(
      "FORBIDDEN",
      "Default and current accounts cannot be deleted."
    );
  }
  if (confirmed !== true)
    return failure("CONFIRMATION_REQUIRED", "Confirm account deletion first.");
  return writeUsers(users.filter((user) => user.id !== targetUserId));
}
