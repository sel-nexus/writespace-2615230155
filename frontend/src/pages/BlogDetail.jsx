/** Display full plain-text writing and permission-aware navigation only. */
import { useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deletePost } from "../lib/posts.js";
import { readPosts } from "../lib/storage.js";
import { formatDate } from "../lib/format.js";
import { canManagePost } from "../lib/permissions.js";
import { Avatar } from "../components/Avatar.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

/** Find the routed post and preserve its text and original metadata.
 * @param {object} props Active session used for local edit visibility.
 * @returns {JSX.Element} Full post or missing feedback with a back link.
 * Notes: The route shell rejects guests; deletion repeats current ownership checks.
 */
export default function BlogDetail({ session = null }) {
  const { id } = useParams();
  const [posts] = useState(readPosts);
  const post = posts.find((candidate) => candidate.id === id);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  /** Confirm explicit deletion and recheck current permissions before persistence.
   * Notes: Leave the rendered post and route unchanged on any rejected mutation.
   */
  function remove() {
    if (!canManagePost(session, post)) {
      setMessage("You cannot manage this post.");
      return;
    }
    if (!window.confirm("Delete this post?")) return;
    const latest = readPosts().find((candidate) => candidate.id === id);
    if (latest && !canManagePost(session, latest)) {
      setMessage("You cannot manage this post.");
      return;
    }
    const result = deletePost(id, session);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    navigate("/blogs");
  }

  if (!post) {
    return (
      <main id="main" className="page-container py-16">
        <EmptyState
          title="Post not found"
          description="This post is not available in this browser."
          to="/blogs"
          action="Back to All Blogs"
        />
      </main>
    );
  }

  return (
    <main id="main" className="page-container py-16">
      <div className="post-detail">
        <Link className="text-primary-700" to="/blogs">
          Back to All Blogs
        </Link>
        <article>
          <header className="space-y-6 mb-10">
            <h1 className="post-title">{post.title}</h1>
            <div className="flex items-center gap-3">
              <Avatar name={post.authorName} />
              <div className="post-author">
                <p>{post.authorName}</p>
                <p className="text-sm text-muted">
                  <time dateTime={post.createdAt}>
                    {formatDate(post.createdAt)}
                  </time>
                </p>
              </div>
            </div>
          </header>
          <div className="post-content">{post.content}</div>
        </article>
        {message && (
          <p className="error-banner" role="alert">
            {message}
          </p>
        )}
        {canManagePost(session, post) && (
          <div className="editor-actions">
            <Link
              className="button secondary"
              to={`/edit/${encodeURIComponent(post.id)}`}
            >
              Edit Post
            </Link>
            <button
              className="button destructive"
              type="button"
              onClick={remove}
            >
              Delete Post
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

BlogDetail.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
};
