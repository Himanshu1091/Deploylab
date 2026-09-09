/**
 * Timestamps are stored in UTC and rendered in the viewer's own timezone,
 * which is what `toLocaleDateString` does by default.
 */
export function formatDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
