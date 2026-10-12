/** Read the complete browser-local collection in newest-first order. */
import { useState } from 'react';
import { readPosts } from '../lib/storage.js';
import { newestPosts } from '../lib/format.js';
import { PostCard } from '../components/PostCard.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

/** Render a guarded list snapshot or the first-post writing journey.
 * @returns {JSX.Element} All local posts without modifying stored records.
 * Notes: The route shell checks the session before mounting this page.
 */
export default function Blogs() {
  const [posts] = useState(() => newestPosts(readPosts()));

  return (
    <main id="main" className="page-container py-16">
      <header>
        <p className="eyebrow">From this browser</p>
        <h1>All Blogs</h1>
      </header>
      {posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="A fresh space, ready for the first words."
          to="/write"
          action="Write a Post"
        />
      ) : (
        <div className="recent-grid">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
        </div>
      )}
    </main>
  );
}
