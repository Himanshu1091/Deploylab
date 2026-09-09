import { useState } from 'react';

import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../context/ToastContext.jsx';
import { updateOwnProfile } from '../api/users.api.js';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { RoleBadge } from '../components/ui/Badge.jsx';
import { formatDate } from '../utils/formatDate.js';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setName(user.name);
    setError('');
    setEditing(true);
  }

  function cancel() {
    setName(user.name);
    setError('');
    setEditing(false);
  }

  async function save(event) {
    event.preventDefault();

    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      setError('Name must be between 2 and 60 characters.');
      return;
    }

    setSaving(true);

    try {
      const updated = await updateOwnProfile({ name: trimmed });

      // Update the auth context too, so the header greeting changes at once
      // rather than staying stale until the next reload.
      setUser(updated);
      setEditing(false);
      toast.success('Profile updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page__title">Profile</h1>
      <p className="page__lead">Your account details.</p>

      <section className="card">
        {editing ? (
          <form onSubmit={save}>
            <Input
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={error}
              autoFocus
            />

            <div className="button-row">
              <Button type="submit" loading={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="secondary" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <dl className="detail-list">
              <dt>Name</dt>
              <dd>{user.name}</dd>

              {/* Email and role are read-only. Changing an email is an identity
                  change that needs verification; changing your own role is a
                  privilege escalation. Both are refused by the server too. */}
              <dt>Email</dt>
              <dd>{user.email}</dd>

              <dt>Role</dt>
              <dd>
                <RoleBadge role={user.role} />
              </dd>

              {user.manager && (
                <>
                  <dt>Manager</dt>
                  <dd>{user.manager.name}</dd>
                </>
              )}

              <dt>Member since</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </dl>

            <div className="button-row">
              <Button variant="secondary" onClick={startEditing}>
                Edit name
              </Button>
            </div>
          </>
        )}
      </section>

      <p className="muted">Only your name can be changed. Contact an administrator for anything else.</p>
    </div>
  );
}
