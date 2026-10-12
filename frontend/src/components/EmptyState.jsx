/** Present clear feedback with an optional native navigation action. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

/** Render empty or missing content without an empty decorative box.
 * Args: title, description, to, action (strings): feedback and optional link.
 * Returns: {JSX.Element} Labelled feedback section.
 */
export function EmptyState({ title, description, to, action }) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      {description && <p className="text-muted">{description}</p>}
      {to && action && <Link className="button secondary" to={to}>{action}</Link>}
    </section>
  );
}
EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  to: PropTypes.string,
  action: PropTypes.string,
};
