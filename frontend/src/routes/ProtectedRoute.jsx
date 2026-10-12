/** Resolve protected route access before mounting route content. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { resolveAccess } from '../lib/permissions.js';

/** Apply deterministic guest and role redirects.
 * Args: session, requiredRole, children: access inputs and guarded content.
 * Returns: {JSX.Element} Redirect or allowed content.
 */
export default function ProtectedRoute({ session, requiredRole, children }) {
  const access = resolveAccess(session, requiredRole);
  return access.allow ? children : <Navigate to={access.redirect} replace />;
}
ProtectedRoute.propTypes = {
  session: PropTypes.object,
  requiredRole: PropTypes.oneOf(['admin', 'user']),
  children: PropTypes.node.isRequired,
};
