"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { DashboardFilterBar } from "../dashboard-filter-bar";

/**
 * Portals the DashboardFilterBar into the navbar search slot.
 * Must be rendered inside DashboardProvider to preserve context access.
 */
export function DashboardNavbarPortal() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("navbar-search-slot");
    if (el) {
      setPortalTarget(el);
      return;
    }

    // Slot not yet in DOM — watch for it to appear
    const observer = new MutationObserver(() => {
      const slot = document.getElementById("navbar-search-slot");
      if (slot) {
        setPortalTarget(slot);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!portalTarget) return null;

  return createPortal(<DashboardFilterBar />, portalTarget);
}
