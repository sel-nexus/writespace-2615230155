/** Render the source-defined role avatar without uploading images. */
import PropTypes from 'prop-types';

/** Show a crown for Admin and a book for an ordinary author.
 * Args: role (string), name (string): displayed identity.
 * Returns: {JSX.Element} Accessible role avatar.
 */
export function Avatar({ role = 'user', name = 'Writer' }) {
  const admin = role === 'admin';
  return (
    <span
      className={`avatar ${admin ? 'bg-secondary-600' : 'bg-primary-500'}`}
      role="img"
      aria-label={`${name}, ${admin ? 'Admin' : 'user'}`}
    >
      <span aria-hidden="true">{admin ? '👑' : '📚'}</span>
    </span>
  );
}
Avatar.propTypes = { role: PropTypes.string, name: PropTypes.string };
