import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

export const THEMES = ['light', 'dark', 'system'];
const STORAGE_KEY = 'deploylab-theme';

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : 'system';
  } catch {
    // Private browsing, or storage disabled. Fall back rather than crash.
    return 'system';
  }
}

/**
 * Writes the choice to the <html> element as a data-theme attribute.
 *
 * 'system' removes the attribute entirely rather than resolving it to a
 * concrete value, which lets the CSS fall through to prefers-color-scheme.
 * That way the page follows the OS live — no listener needed, and it keeps
 * working if the user changes their system theme while the tab is open.
 */
function apply(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);

  useEffect(() => {
    apply(theme);

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Preference simply will not persist. Not worth surfacing.
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (THEMES.includes(next)) setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider.');
  }

  return context;
}
