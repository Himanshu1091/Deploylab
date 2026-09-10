import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateField(key, form) {
  switch (key) {
    case 'name':
      return form.name.trim().length >= 2 && form.name.trim().length <= 60
        ? undefined
        : 'Name must be between 2 and 60 characters.';
    case 'email':
      return EMAIL_PATTERN.test(form.email.trim()) ? undefined : 'Enter a valid email address.';
    case 'password':
      // Mirrors the server rule. bcrypt truncates past 72 bytes, so a longer
      // password would give a false sense of strength.
      return form.password.length >= 8 &&
        form.password.length <= 72 &&
        /[A-Za-z]/.test(form.password) &&
        /[0-9]/.test(form.password)
        ? undefined
        : 'Password must be at least 8 characters and include a letter and a number.';
    case 'confirm':
      return form.confirm === form.password ? undefined : 'Passwords do not match.';
    default:
      return undefined;
  }
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  // Validating on blur rather than on every keystroke: telling someone their
  // password is too short while they are still typing it is just noise.
  const handleBlur = (key) => () => {
    setErrors((current) => ({ ...current, [key]: validateField(key, form) }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const nextErrors = {};
    for (const key of ['name', 'email', 'password', 'confirm']) {
      const error = validateField(key, form);
      if (error) nextErrors[key] = error;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    try {
      // Registration signs the user straight in; the server sets the cookie as
      // part of the response.
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error.code === 'EMAIL_EXISTS') {
        setErrors((current) => ({ ...current, email: error.message }));
      } else {
        setFormError(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="New accounts start with the employee role."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      {formError && <p className="banner banner--error">{formError}</p>}

      <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={update('name')}
            onBlur={handleBlur('name')}
            error={errors.name}
          />

          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            onBlur={handleBlur('email')}
            error={errors.email}
          />

          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            onBlur={handleBlur('password')}
            error={errors.password}
            hint="At least 8 characters, with a letter and a number."
          />

          <Input
            label="Confirm password"
            type="password"
            name="confirm"
            autoComplete="new-password"
            value={form.confirm}
            onChange={update('confirm')}
            onBlur={handleBlur('confirm')}
            error={errors.confirm}
          />

          <Button type="submit" loading={submitting} className="btn--full">
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
      </form>
    </AuthLayout>
  );
}
