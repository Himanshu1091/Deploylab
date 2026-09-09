const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
};

export function RoleBadge({ role }) {
  return <span className={`badge badge--${role}`}>{ROLE_LABELS[role] ?? role}</span>;
}

export function StatusBadge({ active }) {
  return (
    <span className={`badge badge--${active ? 'active' : 'inactive'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}
