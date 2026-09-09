import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../context/ToastContext.jsx';
import * as usersApi from '../api/users.api.js';
import { Button } from '../components/ui/Button.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { TableScroll } from '../components/ui/Table.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { formatDate } from '../utils/formatDate.js';

const ROLES = ['admin', 'manager', 'employee'];
const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', employee: 'Employee' };
const PAGE_SIZE = 20;

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [query, setQuery] = useState({ page: 1, role: '', search: '' });
  const [searchInput, setSearchInput] = useState('');

  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [managers, setManagers] = useState([]);
  const [busyRow, setBusyRow] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  // Debounced, so typing a name does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((current) =>
        current.search === searchInput.trim()
          ? current
          : { ...current, search: searchInput.trim(), page: 1 }
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: current.data ? 'refreshing' : 'loading' }));

    try {
      const data = await usersApi.listUsers({
        page: query.page,
        limit: PAGE_SIZE,
        ...(query.role ? { role: query.role } : {}),
        ...(query.search ? { search: query.search } : {}),
      });

      setState({ status: 'ready', data, error: null });
    } catch (error) {
      setState({ status: 'error', data: null, error: error.message });
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  // The manager dropdown needs every manager, not just those on this page.
  const loadManagers = useCallback(async () => {
    try {
      const data = await usersApi.listUsers({ role: 'manager', limit: 100 });
      setManagers(data.users);
    } catch {
      // Non-fatal: the rest of the table still works, the dropdown is just empty.
      setManagers([]);
    }
  }, []);

  useEffect(() => {
    loadManagers();
  }, [loadManagers]);

  /**
   * Applies an update and patches the single affected row in place.
   *
   * On failure nothing in state changes, and since every control reads its
   * value from state, the dropdown or toggle snaps back on its own — no
   * separate rollback path to get wrong.
   */
  async function apply(id, action, successMessage) {
    setBusyRow(id);

    try {
      const updated = await action();

      setState((current) => ({
        ...current,
        data: {
          ...current.data,
          users: current.data.users.map((row) => (row.id === id ? updated : row)),
        },
      }));

      toast.success(successMessage);

      // A role change can add or remove someone from the manager dropdown.
      loadManagers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyRow(null);
      setConfirmation(null);
    }
  }

  function requestRoleChange(row, nextRole) {
    setConfirmation({
      title: 'Change role',
      body: `Change ${row.name}'s role from ${ROLE_LABELS[row.role]} to ${ROLE_LABELS[nextRole]}?`,
      confirmLabel: 'Change role',
      confirmVariant: 'primary',
      run: () => apply(row.id, () => usersApi.changeRole(row.id, nextRole), 'Role updated.'),
    });
  }

  function requestStatusChange(row, nextActive) {
    // Reactivating is harmless, so it happens immediately. Deactivating signs
    // someone out, so it asks first.
    if (nextActive) {
      apply(row.id, () => usersApi.changeStatus(row.id, true), 'Account reactivated.');
      return;
    }

    setConfirmation({
      title: 'Deactivate account',
      body: `Deactivate ${row.name}? They will be signed out immediately and unable to log in.`,
      confirmLabel: 'Deactivate',
      confirmVariant: 'primary',
      run: () => apply(row.id, () => usersApi.changeStatus(row.id, false), 'Account deactivated.'),
    });
  }

  function changeManager(row, managerId) {
    // Easily reversed, so no confirmation.
    apply(
      row.id,
      () => usersApi.assignManager(row.id, managerId || null),
      managerId ? 'Manager assigned.' : 'Manager removed.'
    );
  }

  if (state.status === 'loading') return <LoadingState label="Loading users" />;
  if (state.status === 'error') return <ErrorState message={state.error} onRetry={load} />;

  const { users, pagination } = state.data;
  const rangeStart = (pagination.page - 1) * pagination.limit + 1;
  const rangeEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="page">
      <h1 className="page__title">Users</h1>
      <p className="page__lead">Manage roles, managers, and account access.</p>

      <div className="toolbar">
        <input
          className="field__input toolbar__search"
          type="search"
          placeholder="Search name or email"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search users"
        />

        <select
          className="field__input toolbar__filter"
          value={query.role}
          onChange={(event) => setQuery((current) => ({ ...current, role: event.target.value, page: 1 }))}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {users.length === 0 ? (
        <EmptyState title="No users match this filter." description="Try a different role or search term." />
      ) : (
        <section className="card card--flush">
          <TableScroll>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Manager</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>

              <tbody>
                {users.map((row) => {
                  const isSelf = row.id === currentUser.id;
                  const isBusy = busyRow === row.id;

                  return (
                    <tr key={row.id} className={isBusy ? 'row--busy' : undefined}>
                      <td>
                        {row.name}
                        {isSelf && <span className="tag">you</span>}
                      </td>

                      <td className="cell--muted">{row.email}</td>

                      <td>
                        <select
                          className="select-inline"
                          value={row.role}
                          disabled={isSelf || isBusy}
                          // Disabled on your own row, and refused by the server
                          // as well: a lone admin who demoted themselves would
                          // lock every administrative function out of the system.
                          title={isSelf ? 'You cannot change your own role.' : undefined}
                          onChange={(event) => requestRoleChange(row, event.target.value)}
                          aria-label={`Role for ${row.name}`}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          className="select-inline"
                          value={row.managerId ?? ''}
                          disabled={isBusy}
                          onChange={(event) => changeManager(row, event.target.value)}
                          aria-label={`Manager for ${row.name}`}
                        >
                          <option value="">— None —</option>
                          {managers
                            .filter((manager) => manager.id !== row.id)
                            .map((manager) => (
                              <option key={manager.id} value={manager.id}>
                                {manager.name}
                              </option>
                            ))}
                        </select>
                      </td>

                      <td>
                        {isSelf ? (
                          <span title="You cannot deactivate your own account.">
                            <StatusBadge active={row.isActive} />
                          </span>
                        ) : (
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={row.isActive}
                              disabled={isBusy}
                              onChange={(event) => requestStatusChange(row, event.target.checked)}
                              aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.name}`}
                            />
                            <span>{row.isActive ? 'Active' : 'Inactive'}</span>
                          </label>
                        )}
                      </td>

                      <td className="cell--muted">{formatDate(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </section>
      )}

      {pagination.total > 0 && (
        <div className="pagination">
          <span className="muted">
            Showing {rangeStart}–{rangeEnd} of {pagination.total}
          </span>

          <div className="button-row">
            <Button
              variant="secondary"
              disabled={pagination.page <= 1}
              onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(confirmation)}
        title={confirmation?.title ?? ''}
        confirmLabel={confirmation?.confirmLabel}
        confirmVariant={confirmation?.confirmVariant}
        loading={Boolean(busyRow)}
        onConfirm={() => confirmation?.run()}
        onCancel={() => setConfirmation(null)}
      >
        {confirmation?.body}
      </Modal>
    </div>
  );
}
