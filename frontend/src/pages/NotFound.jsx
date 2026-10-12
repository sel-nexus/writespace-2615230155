/** Show a navigable fallback for unknown or unavailable routes. */
import { EmptyState } from '../components/EmptyState.jsx';

/** Render the route fallback with a real home link.
 * Returns: {JSX.Element} Not-found main landmark.
 */
export default function NotFound() {
  return (
    <main id="main" className="page-container py-24">
      <p className="eyebrow">404 / WriteSpace</p>
      <EmptyState title="Page not found" description="This page is not available." to="/" action="Back to Home" />
    </main>
  );
}
