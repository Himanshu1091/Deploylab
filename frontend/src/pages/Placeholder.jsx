/**
 * Stand-in for the screens built in Phase 7. Phase 6 only needs routes that
 * render something, so the guards, shell, and session handling can be verified
 * on their own before any real screen exists.
 */
export function Placeholder({ title, note }) {
  return (
    <div className="page">
      <h1 className="page__title">{title}</h1>
      <p className="page__lead">{note}</p>
      <p className="muted">Built in Phase 7.</p>
    </div>
  );
}
