/** Present the writing product and at most three real local post previews. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { readPosts } from '../lib/storage.js';
import { excerpt, formatDate, newestPosts } from '../lib/format.js';
import { Avatar } from '../components/Avatar.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { roleHome } from '../lib/permissions.js';

const accents = ['border-t-indigo-600', 'border-t-violet-600', 'border-t-pink-500', 'border-t-teal-500'];

/** Render the paper-wash hero, source feature copy, local preview and footer.
 * Args: session (object|null): optional active identity.
 * Returns: {JSX.Element} Public landing content.
 */
export default function Landing({ session = null }) {
  const [posts] = useState(() => newestPosts(readPosts(), 3));
  return (
    <>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">A little room for your words</p>
              <h1 id="hero-title">Your thoughts. Your space. Beautifully simple.</h1>
              <p className="text-lg text-muted">A quiet place to put pen to page. Write, read, and keep your ideas close — right here in your browser.</p>
              <div className="hero-actions">
                <Link className="button primary" to={session ? roleHome(session) : '/register'}>
                  {session ? 'Go to Dashboard' : 'Get Started Free'}
                </Link>
                <Link className="button secondary" to="/blogs">Start Reading</Link>
              </div>
            </div>
            <div className="paper-note" aria-hidden="true">
              <p className="eyebrow">WriteSpace / A fresh page</p>
              <blockquote>Every thought starts with a little space.</blockquote>
              <div className="paper-lines" />
              <p className="text-sm text-muted mt-6">Make it yours.</p>
            </div>
          </div>
        </section>
        <div className="page-container">
          <section className="features" aria-label="Features">
            <article className="feature border-t-indigo-600">
              <p className="eyebrow">01 / Expression</p>
              <h2>Write Freely</h2>
              <p>Let your ideas take shape in plain text, without the distractions.</p>
            </article>
            <article className="feature border-t-violet-600">
              <p className="eyebrow">02 / Your browser</p>
              <h2>Private &amp; Local</h2>
              <p>Your writing stays in this browser profile. No cloud account or synchronization.</p>
            </article>
            <article className="feature border-t-teal-500">
              <p className="eyebrow">03 / In the moment</p>
              <h2>Instant &amp; Fast</h2>
              <p>Move from a thought to a page with simple, local navigation.</p>
            </article>
          </section>
          <section className="py-16" aria-labelledby="latest-title">
            <p className="eyebrow">From this browser</p>
            <h2 id="latest-title">Latest Posts</h2>
            {posts.length === 0 ? (
              <EmptyState
                title="No posts yet"
                description="A fresh space, ready for the first words."
                to={session ? '/write' : '/register'}
                action="Get Started"
              />
            ) : (
              <div className="recent-grid">
                {posts.map((post, index) => (
                  <article className={`preview-card ${accents[index % 4]}`} key={post.id}>
                    <p className="text-sm text-muted">{formatDate(post.createdAt)}</p>
                    <h3><Link to={`/blog/${encodeURIComponent(post.id)}`}>{post.title}</Link></h3>
                    <p className="text-muted">{excerpt(post.content)}</p>
                    <div className="flex items-center gap-3">
                      <Avatar name={post.authorName} />
                      <span className="text-sm">{post.authorName}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <p className="demo-warning">
            Demo only: credentials are stored in plaintext. Sessions and roles can
            be modified in your browser. Use synthetic, non-sensitive data only —
            never a real password. Clearing browser storage loses local data; tabs
            do not synchronize.
          </p>
        </div>
      </main>
      <footer className="footer">
        <div className="page-container flex flex-col gap-6 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} WriteSpace</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-6">
            <Link to="/">Home</Link>
            <Link to="/blogs">All Blogs</Link>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
Landing.propTypes = { session: PropTypes.object };
