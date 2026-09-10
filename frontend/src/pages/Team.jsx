import { useCallback, useEffect, useState } from 'react';

import { getTeam } from '../api/users.api.js';
import { RoleBadge, StatusBadge } from '../components/ui/Badge.jsx';
import { TableScroll } from '../components/ui/Table.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { usePageHeader, TopbarActions } from '../context/PageHeaderContext.jsx';
import { initials } from '../utils/initials.js';
import { formatDate } from '../utils/formatDate.js';

export default function Team() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  // Before the early returns below, or the hook order changes between renders.
  usePageHeader('My Team', 'Your direct reports. This view is read-only.');

  const load = useCallback(async () => {
    setState({ status: 'loading', data: null, error: null });

    try {
      setState({ status: 'ready', data: await getTeam(), error: null });
    } catch (error) {
      setState({ status: 'error', data: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') return <LoadingState label="Loading your team" />;
  if (state.status === 'error') return <ErrorState message={state.error} onRetry={load} />;

  const { team, count } = state.data;

  return (
    <div className="page">
      <TopbarActions>
        <span className="count-pill">{count === 1 ? '1 report' : `${count} reports`}</span>
      </TopbarActions>

      {/* An empty team is the default state for a newly promoted manager, so
          it gets an explanation rather than anything that looks like failure. */}
      {count === 0 ? (
        <EmptyState
          title="No team members assigned yet."
          description="An administrator can assign reports to you."
        />
      ) : (
        <section className="card card--flush">
          <TableScroll>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="person">
                        <span className="avatar" aria-hidden="true">
                          {initials(member.name)}
                        </span>
                        <div className="person__text">
                          <span className="person__name">{member.name}</span>
                          <span className="person__email">{member.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <RoleBadge role={member.role} />
                    </td>
                    <td>
                      <StatusBadge active={member.isActive} />
                    </td>
                    <td className="cell--muted">{formatDate(member.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </section>
      )}
    </div>
  );
}
