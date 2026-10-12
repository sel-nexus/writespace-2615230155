/** Present responsive local accounts and validated Admin management. */
import { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { readUsers } from "../lib/storage.js";
import {
  canDeleteUser,
  isDefaultAdmin,
  resolveAccess,
} from "../lib/permissions.js";
import {
  accountRows,
  createManagedUser,
  deleteManagedUser,
} from "../lib/users.js";
import { formatDate } from "../lib/format.js";
import { Avatar } from "../components/Avatar.jsx";
import { FormField } from "../components/FormField.jsx";

const emptyFields = { displayName: "", username: "", password: "", role: "" };
const sessionType = PropTypes.shape({
  userId: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
  role: PropTypes.oneOf(["admin", "user"]).isRequired,
});
const accountType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  role: PropTypes.oneOf(["admin", "user"]).isRequired,
  createdAt: PropTypes.string.isRequired,
});

/** Show only permitted delete controls and explain the fixed identity.
 * Args: user, session, onDelete: account, active identity and explicit callback.
 * Returns: {JSX.Element|null} Protected control, eligible button or no self action.
 */
function DeleteAction({ user, session, onDelete }) {
  if (isDefaultAdmin(user)) {
    return (
      <span
        title="Default admin cannot be deleted."
        className="default-account"
      >
        <button
          type="button"
          className="button destructive"
          disabled
          aria-label="Delete default Admin"
        >
          Delete
        </button>
        <span className="text-xs text-muted">
          Default admin cannot be deleted.
        </span>
      </span>
    );
  }
  if (!canDeleteUser(session, user)) return null;
  return (
    <button
      type="button"
      className="button destructive"
      aria-label={`Delete ${user.username}`}
      onClick={() => onDelete(user)}
    >
      Delete
    </button>
  );
}
DeleteAction.propTypes = {
  user: accountType.isRequired,
  session: sessionType,
  onDelete: PropTypes.func.isRequired,
};

/** Render a canonical role as a source-palette badge.
 * Args: role: canonical role.
 * Returns: {JSX.Element} Visible Admin or user badge.
 */
function RoleBadge({ role }) {
  return (
    <span className={`role-badge role-${role}`}>
      {role === "admin" ? "Admin" : "user"}
    </span>
  );
}
RoleBadge.propTypes = { role: PropTypes.oneOf(["admin", "user"]).isRequired };

/** Render account creation, desktop table and mobile cards without passwords.
 * Args: session: active Admin used in both handlers and mutation services.
 * Returns: {JSX.Element} Synchronous local account snapshot and field-level feedback.
 */
export default function Users({ session = null }) {
  const [users, setUsers] = useState(readUsers);
  const [fields, setFields] = useState(emptyFields);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const rows = accountRows(users);

  /** Persist before refreshing or clearing entered fields; repeat the active role.
   * Args: event: form submission.
   * Returns: Nothing; show all validation fields or explicit non-success feedback.
   */
  function submit(event) {
    event.preventDefault();
    setSuccess("");
    const result = createManagedUser(fields, session);
    if (!result.ok) {
      setErrors(result.error.fields || {});
      setMessage(result.error.field ? "" : result.error.message);
      return;
    }
    setUsers(readUsers());
    setFields(emptyFields);
    setErrors({});
    setMessage("");
    setSuccess("Account created.");
  }

  /** Require explicit activation, fresh eligibility and native confirmation.
   * Args: user: rendered target; service re-reads after confirmation.
   * Returns: Nothing; never remove displayed data or report success on failure.
   */
  function remove(user) {
    setSuccess("");
    setMessage("");
    const latest = accountRows(readUsers()).find(
      (candidate) => candidate.id === user.id
    );
    if (!latest) {
      setMessage("The selected record no longer exists.");
      return;
    }
    if (!canDeleteUser(session, latest)) {
      setMessage("Default and current accounts cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete account ${latest.username}?`)) return;
    const result = deleteManagedUser(user.id, session, true);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setUsers(readUsers());
    setSuccess("Account deleted.");
  }

  return (
    <main id="main" className="page-container admin-page">
      <header className="admin-banner">
        <p className="text-sm font-bold uppercase tracking-widest mb-4">
          People in this browser
        </p>
        <h1>Users</h1>
        <p className="mt-4">
          Create demo accounts and manage eligible local identities.
        </p>
      </header>
      <Link className="inline-block text-primary-700 mt-6" to="/admin">
        Back to Admin Dashboard
      </Link>
      <section className="managed-create" aria-labelledby="create-title">
        <h2 id="create-title">Create Account</h2>
        <p className="demo-warning mt-3">
          Demo only. Credentials are stored in plaintext; roles are
          client-controlled. Use synthetic, non-sensitive data only.
        </p>
        <form noValidate onSubmit={submit} className="managed-form">
          <FormField
            id="displayName"
            label="Display Name"
            value={fields.displayName}
            autoComplete="off"
            error={errors.displayName}
            onChange={(event) =>
              setFields({ ...fields, displayName: event.target.value })
            }
          />
          <FormField
            id="username"
            label="Username"
            value={fields.username}
            autoComplete="off"
            error={errors.username}
            onChange={(event) =>
              setFields({ ...fields, username: event.target.value })
            }
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            value={fields.password}
            autoComplete="new-password"
            error={errors.password}
            onChange={(event) =>
              setFields({ ...fields, password: event.target.value })
            }
          />
          <div className="form-field">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              name="role"
              value={fields.role}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? "role-error" : undefined}
              onChange={(event) =>
                setFields({ ...fields, role: event.target.value })
              }
            >
              <option value="">Choose a role</option>
              <option value="admin">Admin</option>
              <option value="user">user</option>
            </select>
            {errors.role && (
              <p id="role-error" role="alert" className="field-error">
                {errors.role}
              </p>
            )}
          </div>
          <button type="submit" className="button primary">
            Create Account
          </button>
        </form>
      </section>
      {message && (
        <p role="alert" className="error-banner mt-6">
          {message}
        </p>
      )}
      {success && (
        <p role="status" className="success-banner mt-6">
          {success}
        </p>
      )}
      <section className="managed-list" aria-labelledby="accounts-title">
        <h2 id="accounts-title">Local Accounts</h2>
        {users.length === 0 && (
          <p className="text-muted mt-3">
            No managed accounts yet. The default Admin is always available.
          </p>
        )}
        <div className="users-table-wrap">
          <table className="users-table">
            <caption className="sr-only">
              Local accounts, excluding passwords
            </caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="account-identity">
                      <Avatar role={user.role} name={user.displayName} />
                      <span>{user.displayName}</span>
                    </div>
                  </td>
                  <td>{user.username}</td>
                  <td>
                    <RoleBadge role={user.role} />
                  </td>
                  <td>
                    {isDefaultAdmin(user)
                      ? "Built-in"
                      : formatDate(user.createdAt)}
                  </td>
                  <td>
                    <DeleteAction
                      user={user}
                      session={session}
                      onDelete={remove}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="user-cards" aria-label="Local account cards">
          {rows.map((user) => (
            <li key={user.id} className="user-card">
              <div className="account-identity">
                <Avatar role={user.role} name={user.displayName} />
                <h3>{user.displayName}</h3>
              </div>
              <dl>
                <dt>Username</dt>
                <dd>{user.username}</dd>
                <dt>Role</dt>
                <dd>
                  <RoleBadge role={user.role} />
                </dd>
                <dt>Created</dt>
                <dd>
                  {isDefaultAdmin(user)
                    ? "Built-in"
                    : formatDate(user.createdAt)}
                </dd>
              </dl>
              <DeleteAction user={user} session={session} onDelete={remove} />
            </li>
          ))}
        </ul>
      </section>
      {!resolveAccess(session, "admin").allow && (
        <p className="demo-warning mt-6">Only Admin can manage accounts.</p>
      )}
    </main>
  );
}
Users.propTypes = { session: sessionType };
