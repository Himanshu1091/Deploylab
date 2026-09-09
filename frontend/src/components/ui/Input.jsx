import { useId } from 'react';

export function Input({ label, error, hint, className = '', ...rest }) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        className={`field__input ${error ? 'field__input--error' : ''}`.trim()}
        // Points a screen reader at the message, and marks the control invalid
        // rather than relying on colour alone to signal the problem.
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />

      {error ? (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      ) : (
        hint && <p className="field__hint">{hint}</p>
      )}
    </div>
  );
}
