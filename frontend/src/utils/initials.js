/**
 * First letters of the first two words — "Priya Sharma" becomes "PS".
 *
 * Lives here rather than beside the component that first needed it, so a page
 * showing an avatar does not have to import the whole application shell.
 */
export function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
