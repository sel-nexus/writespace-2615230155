/** Present a local post preview without interpreting author-provided markup. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { excerpt, formatDate } from '../lib/format.js';
import { Avatar } from './Avatar.jsx';

const accents = ['border-t-indigo-600', 'border-t-violet-600', 'border-t-pink-500', 'border-t-teal-500'];

/** Render the exact excerpt, creation date and stored author identity.
 * @param {object} props Post record and its zero-based position in the list.
 * @returns {JSX.Element} Linked preview with a repeating border accent.
 */
export function PostCard({ post, index = 0 }) {
  return (
    <article className={`preview-card ${accents[index % 4]}`}>
      <p className="text-sm text-muted">
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
      </p>
      <h2 className="post-card-title">
        <Link to={`/blog/${encodeURIComponent(post.id)}`}>{post.title}</Link>
      </h2>
      <p className="post-excerpt text-muted">{excerpt(post.content)}</p>
      <div className="flex items-center gap-3">
        <Avatar name={post.authorName} />
        <span className="text-sm post-author">{post.authorName}</span>
      </div>
    </article>
  );
}

PostCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number,
};
