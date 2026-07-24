/**
 * Seam B — routing / URL state.
 *
 * Filters, embed mode and share links are URL-derived, but the package must
 * not depend on any framework router. Hosts inject a `UrlStateAdapter` (and
 * optionally a `LinkComponent`); the default adapter speaks plain
 * `window.history`/`popstate`, so a Vite/plain-React host works with zero
 * wiring. The Next.js implementation lives app-side.
 */

import { createContext, useContext, useMemo } from "react";
import type { ComponentType, ReactNode } from "react";

export interface UrlStateSetOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

export interface UrlStateAdapter {
  /** Read a single query parameter (null when absent). */
  get(key: string): string | null;
  /** Read all query parameters as a plain record. */
  getAll(): Record<string, string>;
  /** Current pathname (no query string). */
  pathname(): string;
  /**
   * Patch query parameters: string values are set, `null` values are removed.
   * Untouched parameters are preserved.
   */
  set(params: Record<string, string | null>, options?: UrlStateSetOptions): void;
  /** Subscribe to URL changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** Minimal window surface the default adapter needs (injectable for tests). */
export interface WindowLike {
  location: { search: string; pathname: string };
  history: {
    pushState(data: unknown, unused: string, url?: string): void;
    replaceState(data: unknown, unused: string, url?: string): void;
  };
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
}

/**
 * Default `UrlStateAdapter` over `window.history` + `popstate`.
 * `win` is injectable for tests / non-browser environments.
 */
export function createWindowHistoryUrlStateAdapter(
  win?: WindowLike
): UrlStateAdapter {
  // Resolve lazily so importing this module in a non-DOM environment is safe.
  const w = (): WindowLike => {
    const resolved = win ?? (globalThis as { window?: WindowLike }).window;
    if (!resolved) {
      throw new Error(
        "createWindowHistoryUrlStateAdapter: no window available — inject a WindowLike or provide a host UrlStateAdapter"
      );
    }
    return resolved;
  };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  return {
    get(key) {
      return new URLSearchParams(w().location.search).get(key);
    },
    getAll() {
      return Object.fromEntries(new URLSearchParams(w().location.search));
    },
    pathname() {
      return w().location.pathname;
    },
    set(params, options) {
      const target = w();
      const search = new URLSearchParams(target.location.search);
      for (const [key, value] of Object.entries(params)) {
        if (value === null) search.delete(key);
        else search.set(key, value);
      }
      const qs = search.toString();
      const url = qs ? `${target.location.pathname}?${qs}` : target.location.pathname;
      if (options?.replace) target.history.replaceState(null, "", url);
      else target.history.pushState(null, "", url);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      const target = w();
      target.addEventListener("popstate", listener);
      return () => {
        listeners.delete(listener);
        target.removeEventListener("popstate", listener);
      };
    },
  };
}

/** Props every injected link component must accept. */
export interface DashboardLinkProps {
  href: string;
  className?: string;
  children?: ReactNode;
  onClick?: (event: { preventDefault(): void }) => void;
}

export type LinkComponent = ComponentType<DashboardLinkProps>;

/** Default link: a plain anchor (hosts inject e.g. next/link). */
export const DefaultLink: LinkComponent = ({ href, className, children, onClick }) => (
  <a href={href} className={className} onClick={onClick}>
    {children}
  </a>
);

interface UrlStateContextValue {
  adapter: UrlStateAdapter | null;
  Link: LinkComponent;
}

const UrlStateContext = createContext<UrlStateContextValue>({
  adapter: null,
  Link: DefaultLink,
});

export interface DashboardUrlStateProviderProps {
  /** Host adapter; defaults to the window.history adapter. */
  adapter?: UrlStateAdapter;
  /** Host link component; defaults to a plain anchor. */
  Link?: LinkComponent;
  children: ReactNode;
}

export function DashboardUrlStateProvider({
  adapter,
  Link,
  children,
}: DashboardUrlStateProviderProps) {
  const value = useMemo<UrlStateContextValue>(
    () => ({ adapter: adapter ?? null, Link: Link ?? DefaultLink }),
    [adapter, Link]
  );
  return <UrlStateContext.Provider value={value}>{children}</UrlStateContext.Provider>;
}

/** Returns the injected adapter, falling back to window.history lazily. */
export function useDashboardUrlState(): UrlStateAdapter {
  const { adapter } = useContext(UrlStateContext);
  return useMemo(() => adapter ?? createWindowHistoryUrlStateAdapter(), [adapter]);
}

export function useDashboardLink(): LinkComponent {
  return useContext(UrlStateContext).Link;
}
