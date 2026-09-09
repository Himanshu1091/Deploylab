import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

const SUCCESS_DURATION_MS = 3000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, variant = 'success') => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, variant }]);

      // Success messages disappear on their own; errors do not. An error the
      // user never read is an error that gets reported as a silent failure.
      if (variant === 'success') {
        setTimeout(() => dismiss(id), SUCCESS_DURATION_MS);
      }
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.variant}`}>
            <span>{toast.message}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider.');
  }

  return context;
}
