"use client";

import { useSearchParams } from "next/navigation";
import { usePermissions } from "@/features/auth/hooks/use-permissions";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";

/**
 * Single source of truth for "what mode is the calendar in" — combines the
 * caller's calendar permissions with the `?as=viewer` URL override.
 *
 * The override lets a user who can view and also plan or assign preview the
 * read-only experience without giving up their real permissions. For users
 * who cannot view the param is silently ignored, so it cannot be used to
 * bypass missing permissions.
 *
 * `?view=…` is reserved for the day/week/month switcher (see
 * planning-header.tsx and planning-calendar.tsx) — do not reuse that name.
 *
 * `canPlan` / `canAssign` are returned as *effective* values: when the
 * override is on, both flip to false, which propagates through every
 * existing gate (sidebar tab disables, chip click handlers, persist-
 * boundary guard) without further wiring. The raw access bits are not
 * exposed here — if you ever need them, call `usePermissions` directly.
 */
export function useCalendarViewMode() {
  const { canAccess, isLoading } = usePermissions();
  const searchParams = useSearchParams();

  const rawCanPlan = !isLoading && canAccess(ACCESS_RULES.calendarPlan);
  const rawCanAssign = !isLoading && canAccess(ACCESS_RULES.calendarAssign);
  const canView = !isLoading && canAccess(ACCESS_RULES.calendarView);

  const forceViewer = canView && searchParams?.get("as") === "viewer";

  const canPlan = rawCanPlan && !forceViewer;
  const canAssign = rawCanAssign && !forceViewer;
  // Either the user is a pure viewer (cannot plan or assign) or they
  // explicitly asked for the preview via the URL override.
  const isViewerOnly =
    canView && (forceViewer || (!rawCanPlan && !rawCanAssign));
  // A "preview toggle" only makes sense for users who can actually flip
  // between the two modes — i.e. they can view *and* plan or assign. Pure
  // viewers have nothing to toggle into; planners who cannot view are not
  // allowed to preview.
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
