"use client";

import type { ReactNode } from "react";
import { useHeaderPageActionsOutlet } from "./header-page-actions-context";

/**
 * The right-hand actions strip of the unified header, in three groups:
 *
 *   1. Page-based   — injected per route via <HeaderPageActions> (count badges,
 *                     view switchers, page-scoped buttons…). Empty on most pages.
 *   2. System-based — harness toggle, notifications, day/night toggle.
 *   3. User-based   — the user menu.
 *
 * Dividers between groups collapse automatically when the group to their left
 * has no content (the page group is empty on most routes).
 */
interface HeaderActionsProps {
  systemActions?: ReactNode;
  userActions?: ReactNode;
}

function Divider({ className = "" }: Readonly<{ className?: string }>) {
  return (
    <span
      aria-hidden="true"
      className={`mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-700 ${className}`}
    />
  );
}

export function HeaderActions({
  systemActions,
  userActions,
}: Readonly<HeaderActionsProps>) {
  const setOutlet = useHeaderPageActionsOutlet();

  return (
    <div className="flex items-center gap-1">
      {/* 1. Page-based — portal target; `peer` so the divider can react to it */}
      <div
        ref={setOutlet}
        data-testid="header-page-actions"
        className="peer flex items-center gap-1 empty:hidden"
      />
      <Divider className="peer-empty:hidden" />

      {/* 2. System-based */}
      {systemActions && (
        <div
          data-testid="header-system-actions"
          className="flex items-center gap-1"
        >
          {systemActions}
        </div>
      )}

      {/* 3. User-based */}
      {userActions && (
        <>
          <Divider />
          <div data-testid="header-user-actions" className="flex items-center">
            {userActions}
          </div>
        </>
      )}
    </div>
  );
}
