"use client";

import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { HeaderActions } from "./header-actions";

/**
 * The unified page + system header.
 *
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ [Breadcrumbs]        [Search bar]        [ page | system | user ]     │  top row
 *   ├──────────────────────────────────────────────────────────────────────┤
 *   │ [ filter badges … ]                                                   │  filter row
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * The filter row is a child of this component (not a sibling): pages get one
 * header element that owns both the breadcrumb/action row and the route's
 * filter bar.
 */
interface UnifiedHeaderProps {
  /**
   * Far left of the top row, before the breadcrumb — the owl mark, for the
   * layout variant that keeps the brand in the header instead of the sidebar.
   */
  brand?: ReactNode;
  /** Left: breadcrumb trail for the current route. */
  breadcrumb: ReactNode;
  /** Center: global search (SpotlightSearch). Collapses to a square button when narrow. */
  search?: ReactNode;
  /** Right, middle group: system actions (harness / notifications / theme). */
  systemActions?: ReactNode;
  /** Right, last group: the user menu. */
  userActions?: ReactNode;
  /** Bottom row: route-scoped filter badges. Omitted when the route has none. */
  filterBar?: ReactNode;
  className?: string;
}

export function UnifiedHeader({
  brand,
  breadcrumb,
  search,
  systemActions,
  userActions,
  filterBar,
  className,
}: Readonly<UnifiedHeaderProps>) {
  return (
    <header
      data-testid="unified-header"
      className={twMerge(
        "z-20 flex w-full shrink-0 flex-col border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
        className
      )}
    >
      {/* Top row */}
      <div className="flex h-14 items-stretch">
        {/* Far left — optional brand mark, sized to the sidebar rail (w-14),
            owl centered in the square so it lines up with the icons below,
            divider separating it from the breadcrumb. */}
        {brand && (
          <div className="flex w-14 shrink-0 items-center justify-center border-r border-gray-200 dark:border-gray-700">
            {brand}
          </div>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
          {/* Left — breadcrumbs, pinned to the far left */}
          <div className="flex min-w-0 flex-1 items-center">{breadcrumb}</div>

          {/* Center — search */}
          {search && (
            <div className="w-full min-w-10 max-w-sm shrink">{search}</div>
          )}

          {/* Right — actions, pinned to the far right */}
          <div className="flex shrink-0 items-center justify-end">
            <HeaderActions
              systemActions={systemActions}
              userActions={userActions}
            />
          </div>
        </div>
      </div>

      {/* Bottom row — route filter bar (child of the header) */}
      {filterBar}
    </header>
  );
}
