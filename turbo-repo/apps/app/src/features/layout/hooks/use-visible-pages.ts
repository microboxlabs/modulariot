"use client";

import { useMemo } from "react";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { visiblePages } from "../models/pages";
import type { SidebarItem } from "../types/common.types";

/**
 * The pages navigation should render, with the Dev and Storytelling sections
 * each filtered by their own runtime config flag rather than a build-time
 * env var.
 *
 * Both surfaces that build navigation use this — the sidebar
 * (SidebarNavigationProvider) and Spotlight — so neither section can appear
 * in one and not the other.
 *
 * Fails closed: `useRuntimeConfig()` is null until the config fetch resolves,
 * which reads as "both off". Entries appear a beat after mount when enabled,
 * and never appear at all when they aren't — the safe direction for sections
 * that shouldn't be in front of real users.
 */
export function useVisiblePages(): SidebarItem[] {
  const runtimeConfig = useRuntimeConfig();
  const devToolsEnabled = runtimeConfig?.ENABLE_DEV_TOOLS === "true";
  const storytellingEnabled = runtimeConfig?.ENABLE_STORYTELLING === "true";
  return useMemo(
    () => visiblePages(devToolsEnabled, storytellingEnabled),
    [devToolsEnabled, storytellingEnabled],
  );
}
