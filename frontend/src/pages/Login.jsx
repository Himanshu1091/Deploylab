import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';

export default function Login() {
  const { login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  function validate() {
    const errors = {};
    if (!form.email.trim()) errors.email = 'Enter your email address.';
    if (!form.password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (!validate()) return;

    setSubmitting(true);

    try {
      await login(form);

      // Return them to whatever they were trying to reach before the guard
      // bounced them here.
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue."
      footer={
        <>
          No account? <Link to="/register">Create one</Link>
        </>
      }
    >
      {sessionExpired && (
        <p className="banner banner--warning">Your session expired. Please log in again.</p>
      )}

      {formError && <p className="banner banner--error">{formError}</p>}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
        />

        <Button type="submit" loading={submitting} className="btn--full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
