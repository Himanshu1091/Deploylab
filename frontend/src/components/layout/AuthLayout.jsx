import { ThemeToggle } from '../ui/ThemeToggle.jsx';

const POINTS = [
  'Three roles, enforced on the server',
  'Sessions in an httpOnly cookie',
  'Deployed automatically on every merge',
];

/**
 * Split layout: form on the left, brand panel on the right.
 *
 * The panel is hidden below 60rem rather than stacked. Stacked, it pushes the
 * form below the fold on a phone, which puts decoration in front of the thing
 * the visitor came to do.
 */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth__form-side">
        <div className="auth__toggle">
          <ThemeToggle />
        </div>

        <div className="auth__card">
          <span className="wordmark__mark auth__mark" aria-hidden="true" />

          <h1 className="auth__title">{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>

          {children}

          {footer && <p className="auth__foot">{footer}</p>}
        </div>
      </div>

      <aside className="auth__brand" aria-hidden="true">
        <div className="auth__brand-inner">
          <p className="auth__brand-eyebrow">Deploylab</p>
          <p className="auth__brand-title">
            A small app, deployed properly.
          </p>

          <ul className="auth__brand-list">
            {POINTS.map((point) => (
              <li key={point}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
