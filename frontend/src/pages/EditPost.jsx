/** Gate post editing by active identity and preserve original creation metadata. */
import { useState } from "react";
import PropTypes from "prop-types";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { isSession, readPosts } from "../lib/storage.js";
import { canManagePost } from "../lib/permissions.js";
import { updatePost } from "../lib/posts.js";
import { PostEditor } from "../components/PostEditor.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

/** Render a prefilled editor only for Admin or owner after the guest gate.
 * Args: session (object|null): active rendered identity.
 * Returns: {JSX.Element} Editor, missing feedback or deterministic redirect.
 * Notes: Keep the render snapshot on failed saves; the service reads fresh state.
 */
export default function EditPost({ session = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [posts] = useState(() => (isSession(session) ? readPosts() : []));
  const post = posts.find((candidate) => candidate.id === id);

  /** Save against the latest target and navigate only after persistence succeeds. */
  function save(fields) {
    const result = updatePost(id, fields, session);
    if (result.ok) navigate(`/blog/${encodeURIComponent(result.value.id)}`);
    return result;
  }

  if (!isSession(session)) return <Navigate to="/login" replace />;
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
  if (!canManagePost(session, post)) return <Navigate to="/blogs" replace />;
  return (
    <main id="main" className="page-container py-16">
      <section className="editor-layout" aria-labelledby="edit-title">
        <p className="eyebrow">Refine your words</p>
        <h1 id="edit-title">Edit Post</h1>
        <PostEditor
          key={id}
          initialFields={post}
          submitLabel="Save Changes"
          onSave={save}
          onCancel={() => navigate(`/blog/${encodeURIComponent(id)}`)}
        />
      </section>
    </main>
  );
}

EditPost.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
};
