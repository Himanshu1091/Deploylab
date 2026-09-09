/**
 * Wraps a table in its own horizontal scroll container.
 *
 * Without this, a table wider than the viewport makes the whole page scroll
 * sideways on a phone, which drags the header and navigation off screen too.
 */
export function TableScroll({ children }) {
  return <div className="table-scroll">{children}</div>;
}
