/** Show local activity and explicitly activated Admin oversight actions. */
import { useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { readPosts, readUsers } from "../lib/storage.js";
import { resolveAccess, canManagePost } from "../lib/permissions.js";
import { countUsers } from "../lib/users.js";
import { deletePost } from "../lib/posts.js";
import { newestPosts, formatDate } from "../lib/format.js";
import { Avatar } from "../components/Avatar.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

/** Render four counts, five recent posts and quick navigation.
 * Args: session (object|null): active identity for repeated action checks.
 * Returns: {JSX.Element} Synchronous local activity snapshot; no loading state.
 */
export default function AdminDashboard({ session = null }) {
  const [posts, setPosts] = useState(readPosts);
  const [users] = useState(readUsers);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const counts = countUsers(users);
  const recent = newestPosts(posts, 5);
  const stats = [
    ["Total Posts", posts.length, "indigo"],
    ["Total Users", counts.totalUsers, "violet"],
    ["Total Admins", counts.totalAdmins, "pink"],
    ["Total user accounts", counts.totalMembers, "teal"],
  ];

  /** Repeat Admin and latest ownership checks before activating an edit or delete.
   * Args: event, id, deleting: activation event, target ID and mutation choice.
   * Returns: Nothing; preserve route and rendered snapshot on error or cancel.
   */
  function manage(event, id, deleting) {
    // Preserve native link activation; EditPost rechecks destination guards.
    if (
      !deleting &&
      (event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey)
    ) {
      return;
    }
    event.preventDefault();
    setMessage("");
    if (!resolveAccess(session, "admin").allow) {
      setMessage("Only Admin can manage all posts.");
      return;
    }
    const latest = readPosts().find((post) => post.id === id);
    if (!latest) {
      setMessage("The selected record no longer exists.");
      return;
    }
    if (!canManagePost(session, latest)) {
      setMessage("You cannot manage this post.");
      return;
    }
    if (!deleting) {
      navigate(`/edit/${encodeURIComponent(id)}`);
      return;
    }
    if (!window.confirm("Delete this post?")) return;
    if (!resolveAccess(session, "admin").allow) {
      setMessage("Only Admin can manage all posts.");
      return;
    }
    const result = deletePost(id, session);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setPosts(readPosts());
  }

  return (
    <main id="main" className="page-container admin-page">
      <header className="admin-banner">
        <p className="text-sm font-bold uppercase tracking-widest mb-4">
          Local workspace oversight
        </p>
        <h1>Admin Dashboard</h1>
        <p className="mt-4">
          A clear view of the writing and people in this browser.
        </p>
      </header>
      <section className="admin-stats" aria-label="Workspace counts">
        {stats.map(([label, value, accent]) => (
          <div className={`admin-stat accent-${accent}`} key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <nav className="admin-quick-links" aria-label="Quick actions">
        <Link className="button primary" to="/write">
          Write a Post
        </Link>
        <Link className="button secondary" to="/users">
          Manage Users
        </Link>
        <Link className="button secondary" to="/blogs">
          View All Blogs
        </Link>
      </nav>
      <section aria-labelledby="recent-title" className="admin-recent">
        <h2 id="recent-title">Recent Posts</h2>
        <p className="text-muted mt-2">
          The five newest entries. Admin can edit or delete any author’s post.
        </p>
        {message && (
          <p role="alert" className="error-banner mt-6">
            {message}
          </p>
        )}
        {recent.length ? (
          <ul className="admin-posts">
            {recent.map((post) => (
              <li key={post.id} className="admin-post">
                <div className="min-w-0">
                  <h3>
                    <Link to={`/blog/${encodeURIComponent(post.id)}`}>
                      {post.title}
                    </Link>
                  </h3>
                  <div className="flex items-center gap-3 mt-3">
                    <Avatar name={post.authorName} />
                    <p className="text-sm text-muted">
                      {post.authorName} ·{" "}
                      <time dateTime={post.createdAt}>
                        {formatDate(post.createdAt)}
                      </time>
                    </p>
                  </div>
                </div>
                {resolveAccess(session, "admin").allow &&
                  canManagePost(session, post) && (
                    <div className="admin-post-actions">
                      <Link
                        className="button secondary"
                        aria-label={`Edit ${post.title}`}
                        to={`/edit/${encodeURIComponent(post.id)}`}
                        onClick={(event) => manage(event, post.id, false)}
                      >
                        Edit
                      </Link>
                      <button
                        className="button destructive"
                        type="button"
                        aria-label={`Delete ${post.title}`}
                        onClick={(event) => manage(event, post.id, true)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No posts yet"
            description="Start the first entry in this local workspace."
            to="/write"
            action="Write your first post"
          />
        )}
      </section>
      <p className="demo-warning mt-8">
        Demo only. Plaintext credentials and client-side roles are not trusted
        authorization. Use synthetic, non-sensitive data only.
      </p>
    </main>
  );
}

AdminDashboard.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
};
