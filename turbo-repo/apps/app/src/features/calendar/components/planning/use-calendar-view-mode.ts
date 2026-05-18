"use client";

import { useSearchParams } from "next/navigation";
import { usePermissions } from "@/features/auth/hooks/use-permissions";

/**
 * Single source of truth for "what mode is the calendar in" — combines the
 * caller's Alfresco groups with the `?as=viewer` URL override.
 *
 * The override lets a user who holds both GROUP_CALENDAR_VIEWER and one of
 * the mutating groups (GROUP_PLANNING / GROUP_ASSIGNMENT) preview the
 * read-only experience without giving up their real permissions. For users
 * who lack GROUP_CALENDAR_VIEWER the param is silently ignored, so it
 * cannot be used to bypass missing permissions.
 *
 * `?view=…` is reserved for the day/week/month switcher (see
 * planning-header.tsx and planning-calendar.tsx) — do not reuse that name.
 *
 * `canPlan` / `canAssign` are returned as *effective* values: when the
 * override is on, both flip to false, which propagates through every
 * existing gate (sidebar tab disables, chip click handlers, persist-
 * boundary guard) without further wiring. The raw permission bits live in
 * the Alfresco membership response and are not exposed here — if you ever
 * need them, call `usePermissions` directly.
 */
export function useCalendarViewMode() {
  const { hasPermission, isLoading } = usePermissions();
  const searchParams = useSearchParams();

  const rawCanPlan = !isLoading && hasPermission(["GROUP_PLANNING"]);
  const rawCanAssign = !isLoading && hasPermission(["GROUP_ASSIGNMENT"]);
  const canView = !isLoading && hasPermission(["GROUP_CALENDAR_VIEWER"]);

  const forceViewer = canView && searchParams?.get("as") === "viewer";

  const canPlan = rawCanPlan && !forceViewer;
  const canAssign = rawCanAssign && !forceViewer;
  // Either the user is a pure viewer (no mutating groups) or they
  // explicitly asked for the preview via the URL override.
  const isViewerOnly =
    canView && (forceViewer || (!rawCanPlan && !rawCanAssign));
  // A "preview toggle" only makes sense for users who can actually flip
  // between the two modes — i.e. they hold the viewer group *and* at
  // least one mutating group. Pure viewers have nothing to toggle into;
  // planners without the viewer group are not allowed to preview.
  const canTogglePreview = canView && (rawCanPlan || rawCanAssign);

  return {
    canPlan,
    canAssign,
    canView,
    forceViewer,
    isViewerOnly,
    canTogglePreview,
    isLoadingPermissions: isLoading,
  };
}
