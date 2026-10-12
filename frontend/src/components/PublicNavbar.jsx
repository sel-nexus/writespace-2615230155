/** Provide sticky public navigation with a stateful mobile menu. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { roleHome } from '../lib/permissions.js';
import { Avatar } from './Avatar.jsx';

/** Render guest entry actions or the signed-in role-home link.
 * Args: session (object|null): active browser-local identity.
 * Returns: {JSX.Element} Responsive public header.
 */
export function PublicNavbar({ session = null }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="navbar">
      <div className="nav-inner">
        <Link className="brand" to="/" onClick={() => setOpen(false)}>
          WriteSpace
          <span aria-hidden="true">.</span>
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="public-links"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close menu' : 'Open menu'}
        </button>
        <nav id="public-links" aria-label="Public navigation" className={`nav-links ${open ? 'is-open' : ''}`}>
          {session ? (
            <>
              <Avatar role={session.role} name={session.displayName} />
              <span>{session.displayName}</span>
              <Link className="button primary" to={roleHome(session)} onClick={() => setOpen(false)}>
                {session.role === 'admin' ? 'Admin Dashboard' : 'All Blogs'}
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)}>Login</Link>
              <Link className="button primary" to="/register" onClick={() => setOpen(false)}>Get Started</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
PublicNavbar.propTypes = { session: PropTypes.object };
