/** Display full plain-text writing and permission-aware navigation only. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { readPosts } from '../lib/storage.js';
import { formatDate } from '../lib/format.js';
import { canManagePost } from '../lib/permissions.js';
import { Avatar } from '../components/Avatar.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

/** Find the routed post and preserve its text and original metadata.
 * @param {object} props Active session used for local edit visibility.
 * @returns {JSX.Element} Full post or missing feedback with a back link.
 * Notes: The route shell rejects guests; deletion belongs to the writing slice.
 */
export default function BlogDetail({ session = null }) {
  const { id } = useParams();
  const [posts] = useState(readPosts);
  const post = posts.find((candidate) => candidate.id === id);

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
        <Link className="text-primary-700" to="/blogs">Back to All Blogs</Link>
        <article>
          <header className="space-y-6 mb-10">
            <h1 className="post-title">{post.title}</h1>
            <div className="flex items-center gap-3">
              <Avatar name={post.authorName} />
              <div className="post-author">
                <p>{post.authorName}</p>
                <p className="text-sm text-muted">
                  <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
                </p>
              </div>
            </div>
          </header>
          <div className="post-content">{post.content}</div>
        </article>
        {canManagePost(session, post) && (
          <Link className="button secondary" to={`/edit/${encodeURIComponent(post.id)}`}>
            Edit Post
          </Link>
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
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
