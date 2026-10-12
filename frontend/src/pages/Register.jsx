/** Create ordinary demo accounts with field errors and partial-write recovery. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { register } from '../lib/auth.js';
import { roleHome } from '../lib/permissions.js';
import { FormField } from '../components/FormField.jsx';

/** Render self-registration without a managed-role field.
 * Args: session (object|null), onSession (Function): active identity and success callback.
 * Returns: {JSX.Element} Form or existing-session redirect.
 */
export default function Register({ session = null, onSession }) {
  const [fields, setFields] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  if (session) return <Navigate to={roleHome(session)} replace />;

  /** Keep the form and entered data on validation or persistence failure. */
  function submit(event) {
    event.preventDefault();
    const result = register(fields);
    if (!result.ok) {
      setErrors(result.error.fields || {});
      setMessage(result.error.field ? '' : result.error.message);
      return;
    }
    onSession(result.value);
    navigate('/blogs', { replace: true });
  }
  return (
    <main id="main" className="auth-layout">
      <section>
        <p className="eyebrow">Your first page</p>
        <h1>Make room for your ideas.</h1>
        <p className="mt-6 text-muted">Create a local user account and start your own writing space.</p>
        <p className="demo-warning mt-8">
          Demo only. Credentials are stored in plaintext. Client-side roles are not
          trusted authorization. Use synthetic, non-sensitive data only. Accounts
          exist only in this browser profile.
        </p>
      </section>
      <section className="auth-card" aria-labelledby="register-title">
        <h2 id="register-title">Get Started Free</h2>
        <form noValidate onSubmit={submit}>
          <FormField
            id="displayName"
            label="Display Name"
            value={fields.displayName}
            autoComplete="nickname"
            error={errors.displayName}
            onChange={(event) => setFields({ ...fields, displayName: event.target.value })}
          />
          <FormField
            id="username"
            label="Username"
            value={fields.username}
            autoComplete="username"
            error={errors.username}
            onChange={(event) => setFields({ ...fields, username: event.target.value })}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            value={fields.password}
            autoComplete="new-password"
            error={errors.password}
            onChange={(event) => setFields({ ...fields, password: event.target.value })}
          />
          <FormField
            id="confirmPassword"
            label="Confirm Password"
            type="password"
            value={fields.confirmPassword}
            autoComplete="new-password"
            error={errors.confirmPassword}
            onChange={(event) => setFields({ ...fields, confirmPassword: event.target.value })}
          />
          {message && <p className="error-banner" role="alert">{message}</p>}
          <button type="submit" className="button primary w-full">Create Account</button>
        </form>
        <p className="mt-6 text-sm">Already have an account? <Link className="text-primary-700 underline" to="/login">Login</Link></p>
      </section>
    </main>
  );
}
Register.propTypes = { session: PropTypes.object, onSession: PropTypes.func.isRequired };
