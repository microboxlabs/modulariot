"use client";

import { useMemo } from "react";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { visiblePages } from "../models/pages";
import type { SidebarItem } from "../types/common.types";

/**
 * The pages navigation should render, with the Dev section filtered by the
 * runtime config rather than a build-time env var.
 *
 * Both surfaces that build navigation use this — the sidebar
 * (SidebarNavigationProvider) and Spotlight — so the Dev section can't appear
 * in one and not the other.
 *
 * Fails closed: `useRuntimeConfig()` is null until the config fetch resolves,
 * which reads as "dev tools off". The Dev entry appears a beat after mount
 * when enabled, and never appears at all when it isn't — the safe direction
 * for a section that shouldn't be in front of real users.
 */
export function useVisiblePages(): SidebarItem[] {
  const runtimeConfig = useRuntimeConfig();
  const devToolsEnabled = runtimeConfig?.ENABLE_DEV_TOOLS === "true";
  return useMemo(() => visiblePages(devToolsEnabled), [devToolsEnabled]);
}
