"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Lets any page inject its own "page-based" controls into the unified header's
 * actions strip (the left-most action group — e.g. the kanban visible-count
 * badge, the table/kanban view switcher).
 *
 * The header renders an outlet element and registers it here; a page renders
 * <HeaderPageActions> anywhere in its subtree and its children are portalled
 * into that outlet. A portal (rather than a shared ReactNode state slot) keeps
 * the page's own React context/handlers working and avoids the render loop a
 * "setNode(<jsx/>)" API would cause.
 */
interface HeaderPageActionsContextValue {
  outlet: HTMLElement | null;
  setOutlet: (el: HTMLElement | null) => void;
}

const HeaderPageActionsContext =
  createContext<HeaderPageActionsContextValue | null>(null);

export function HeaderPageActionsProvider({
  children,
}: Readonly<PropsWithChildren>) {
  const [outlet, setOutlet] = useState<HTMLElement | null>(null);

  const value = useMemo<HeaderPageActionsContextValue>(
    () => ({ outlet, setOutlet }),
    [outlet]
  );

  return (
    <HeaderPageActionsContext.Provider value={value}>
      {children}
    </HeaderPageActionsContext.Provider>
  );
}

function useHeaderPageActionsContext(): HeaderPageActionsContextValue {
  const ctx = useContext(HeaderPageActionsContext);
  if (!ctx) {
    throw new Error(
      "useHeaderPageActionsContext must be used within a HeaderPageActionsProvider"
    );
  }
  return ctx;
}

/**
 * Callback ref for the header to mark where page actions should land.
 * Usage: <div ref={useHeaderPageActionsOutlet()} />
 */
export function useHeaderPageActionsOutlet(): (el: HTMLElement | null) => void {
  return useHeaderPageActionsContext().setOutlet;
}

/**
 * Rendered by a page (at any depth) to place controls in the header's
 * page-actions group. Renders nothing until the header outlet exists.
 */
export function HeaderPageActions({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { outlet } = useHeaderPageActionsContext();
  if (!outlet) return null;
  return createPortal(children, outlet);
}
