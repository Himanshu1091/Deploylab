export function Spinner({ label = 'Loading' }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

/** Fills the viewport. Used while the session is being restored on first load. */
export function FullPageSpinner({ label = 'Loading' }) {
  return (
    <div className="full-page-spinner">
      <Spinner label={label} />
    </div>
  );
}
