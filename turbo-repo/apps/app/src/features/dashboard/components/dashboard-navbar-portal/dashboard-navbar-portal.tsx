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
    setPortalTarget(el);
  }, []);

  if (!portalTarget) return null;

  return createPortal(<DashboardFilterBar />, portalTarget);
}
