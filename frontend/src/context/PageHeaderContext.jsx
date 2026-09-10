import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [header, setHeader] = useState({ title: '', description: '' });

  // The DOM node the topbar exposes for page actions. State rather than a ref
  // so that a page rendering before the topbar mounts still re-renders once
  // the slot exists.
  const [actionsSlot, setActionsSlot] = useState(null);

  const value = useMemo(
    () => ({ header, setHeader, actionsSlot, setActionsSlot }),
    [header, actionsSlot]
  );

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

function usePageHeaderContext() {
  const context = useContext(PageHeaderContext);

  if (!context) {
    throw new Error('Page header hooks must be used inside a PageHeaderProvider.');
  }

  return context;
}

/** Read by the shell to render the topbar. */
export function useHeaderSlots() {
  return usePageHeaderContext();
}

/**
 * Publishes a page's title and description to the topbar.
 *
 * Strings only, deliberately. Anything richer would be a new object on every
 * render, and an effect depending on it would loop forever.
 */
export function usePageHeader(title, description = '') {
  const { setHeader } = usePageHeaderContext();

  useEffect(() => {
    setHeader({ title, description });
  }, [title, description, setHeader]);
}

/**
 * Renders a page's actions into the topbar.
 *
 * A portal rather than context, because actions are JSX: passing them through
 * an effect dependency would re-fire on every render.
 */
export function TopbarActions({ children }) {
  const { actionsSlot } = usePageHeaderContext();
  return actionsSlot ? createPortal(children, actionsSlot) : null;
}
