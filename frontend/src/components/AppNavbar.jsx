/** Provide role-aware navigation and an explicit account logout action. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';

/** Render responsive member/Admin links and a keyboard-dismissable dropdown.
 * Args: session (object), onLogout (Function): identity and persistence-aware logout.
 * Returns: {JSX.Element} Authenticated header.
 */
export function AppNavbar({ session, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);
  return (
    <header className="navbar">
      <div className="nav-inner" onKeyDown={(event) => {
        if (event.key === 'Escape') { setMobileOpen(false); setAccountOpen(false); }
      }}>
        <Link className="brand" to="/">
          WriteSpace
          <span aria-hidden="true">.</span>
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={mobileOpen}
          aria-controls="app-links"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? 'Close menu' : 'Open menu'}
        </button>
        <nav
          id="app-links"
          className={`nav-links ${mobileOpen ? 'is-open' : ''}`}
          aria-label="Account navigation"
        >
          <NavLink to="/blogs">All Blogs</NavLink>
          <NavLink to="/write">Write</NavLink>
          {session.role === 'admin' && <NavLink to="/users">Users</NavLink>}
          <div className="account-menu">
            <button
              type="button"
              className="account-trigger"
              aria-expanded={accountOpen}
              aria-controls="account-actions"
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <Avatar role={session.role} name={session.displayName} />
              <span>{session.displayName}</span>
              <span className="role-label">{session.role === 'admin' ? 'Admin' : 'user'}</span>
            </button>
            {accountOpen && (
              <div className="account-actions" id="account-actions">
                <button
                  type="button"
                  onClick={() => { setAccountOpen(false); onLogout(); }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
AppNavbar.propTypes = { session: PropTypes.object.isRequired, onLogout: PropTypes.func.isRequired };
