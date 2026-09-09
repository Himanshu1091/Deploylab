import { useEffect, useRef } from 'react';
import { Button } from './Button.jsx';

/**
 * Confirmation dialog. Used before anything a user would regret: a role change,
 * or deactivating an account.
 */
export function Modal({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    // Focus lands on the dialog rather than staying on the control behind it,
    // so keyboard and screen-reader users are not left outside the dialog.
    confirmRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape' && !loading) onCancel();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal__backdrop"
      // Only a click that both starts and ends on the backdrop dismisses. A
      // drag that began inside the dialog must not close it.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 className="modal__title" id="modal-title">
          {title}
        </h2>

        <div className="modal__body">{children}</div>

        <div className="modal__actions">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant={confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
