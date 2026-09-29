"use client";

import { useEffect } from "react";

const BEFORE_NAVIGATION = "miot:before-navigation";

/** Programmatic navigation must consult this before changing application state. */
export function confirmNavigation(): boolean {
  return globalThis.dispatchEvent(
    new Event(BEFORE_NAVIGATION, { cancelable: true })
  );
}

/** Protect drafts from application links, organization switching and document unload. */
export function useUnsavedNavigation(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return;
    const confirm = (event: Event) => {
      if (!globalThis.confirm(message)) event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const destination = new URL(anchor.href);
      if (
        destination.origin === location.origin &&
        destination.pathname === location.pathname &&
        destination.search === location.search
      )
        return;
      if (!confirmNavigation()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    globalThis.addEventListener(BEFORE_NAVIGATION, confirm);
    globalThis.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      globalThis.removeEventListener(BEFORE_NAVIGATION, confirm);
      globalThis.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, message]);
}
