import { Button } from './Button.jsx';
import { Spinner } from './Spinner.jsx';

export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="state">
      <Spinner label={label} />
    </div>
  );
}

/**
 * An empty result is a normal outcome, not a failure — a newly promoted manager
 * with no reports yet should see an explanation, not something that looks broken.
 */
export function EmptyState({ title, description }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {description && <p className="state__description">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state">
      <p className="state__title">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
