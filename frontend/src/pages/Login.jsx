/** Collect exact demo credentials and surface non-success outcomes. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { login } from '../lib/auth.js';
import { roleHome } from '../lib/permissions.js';
import { validateLogin } from '../lib/validation.js';
import { FormField } from '../components/FormField.jsx';

/** Render guest login or redirect an existing session to its role home.
 * Args: session (object|null), onSession (Function): active identity and success callback.
 * Returns: {JSX.Element} Form or role redirect.
 */
export default function Login({ session = null, onSession }) {
  const [fields, setFields] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  if (session) return <Navigate to={roleHome(session)} replace />;

  /** Validate and establish session only after successful persistence. */
  function submit(event) {
    event.preventDefault();
    setErrors(validateLogin(fields));
    const result = login(fields);
    if (!result.ok) { setMessage(result.error.message); return; }
    onSession(result.value);
    navigate(roleHome(result.value), { replace: true });
  }
  return (
    <main id="main" className="auth-layout">
      <section>
        <p className="eyebrow">Back to your space</p>
        <h1>Welcome back.</h1>
        <p className="mt-6 text-muted">Your words are right where you left them — in this browser.</p>
        <p className="demo-warning mt-8">
          Demo only. Passwords are plaintext and browser sessions are user-modifiable.
          Use synthetic credentials, never a real password.
        </p>
        <p className="mt-6 text-sm">
          {'Try the default Admin: username '}
          <strong>admin</strong>
          {', password '}
          <strong>admin</strong>
          .
        </p>
      </section>
      <section className="auth-card" aria-labelledby="login-title">
        <h2 id="login-title">Login</h2>
        <form noValidate onSubmit={submit}>
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
            autoComplete="current-password"
            error={errors.password}
            onChange={(event) => setFields({ ...fields, password: event.target.value })}
          />
          {message && <p role="alert" className="error-banner">{message}</p>}
          <button className="button primary w-full" type="submit">Login</button>
        </form>
        <p className="mt-6 text-sm">
          {'New here? '}
          <Link className="text-primary-700 underline" to="/register">
            Get Started Free
          </Link>
        </p>
      </section>
    </main>
  );
}
Login.propTypes = { session: PropTypes.object, onSession: PropTypes.func.isRequired };
