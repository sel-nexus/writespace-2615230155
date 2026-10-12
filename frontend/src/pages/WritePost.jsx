/** Publish a browser-local post and navigate only after successful persistence. */
import PropTypes from "prop-types";
import { Navigate, useNavigate } from "react-router-dom";
import { isSession } from "../lib/storage.js";
import { createPost } from "../lib/posts.js";
import { PostEditor } from "../components/PostEditor.jsx";

/** Render the signed-in creation journey with a no-write cancel destination.
 * Args: session (object|null): active identity.
 * Returns: {JSX.Element} Editor or guest redirect.
 */
export default function WritePost({ session = null }) {
  const navigate = useNavigate();

  /** Return the typed outcome and visit detail only after storage accepts the post. */
  function save(fields) {
    const result = createPost(fields, session);
    if (result.ok) navigate(`/blog/${encodeURIComponent(result.value.id)}`);
    return result;
  }

  if (!isSession(session)) return <Navigate to="/login" replace />;
  return (
    <main id="main" className="page-container py-16">
      <section className="editor-layout" aria-labelledby="write-title">
        <p className="eyebrow">Your next page</p>
        <h1 id="write-title">Write a Post</h1>
        <PostEditor onSave={save} onCancel={() => navigate("/blogs")} />
      </section>
    </main>
  );
}

WritePost.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
};
