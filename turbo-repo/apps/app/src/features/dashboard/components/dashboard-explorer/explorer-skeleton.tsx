"use client";

import {
  CELL_INSET_CLASS,
  ExplorerHeader,
  LIST_FRAME_CLASS,
} from "./explorer-columns";
import ExplorerNewMenu from "./explorer-new-menu";
import { NO_FACETS } from "./explorer-tree";

/**
 * The dashboards list while it loads: rows shaped like the real ones, so the
 * page does not jump when they arrive. The text stays for screen readers.
 */

const BAR = "animate-pulse rounded bg-gray-200 dark:bg-gray-700";

/** Name widths, so the rows do not look stamped out. */
const NAME_WIDTHS = ["w-40", "w-56", "w-44", "w-60", "w-48", "w-36", "w-52"];

/** Placeholder rows, aligned with the list's columns; every one complete. */
export function ExplorerSkeletonRows({ label }: Readonly<{ label: string }>) {
  return (
    <output aria-busy="true" className="block">
      <span className="sr-only">{label}</span>
      <ul aria-hidden>
        {NAME_WIDTHS.map((width) => (
          <li key={width} className="flex h-10 items-center gap-3 px-3">
            <div className={`h-4 w-4 shrink-0 ${BAR}`} />
            <div className="min-w-0 flex-1">
              <div className={`h-3.5 max-w-full ${width} ${BAR}`} />
            </div>
            <div
              className={`hidden w-56 shrink-0 gap-1 md:flex ${CELL_INSET_CLASS}`}
            >
              <div className={`h-5 w-16 ${BAR}`} />
              <div className={`h-5 w-12 ${BAR}`} />
            </div>
            <div className={`hidden w-32 shrink-0 sm:flex ${CELL_INSET_CLASS}`}>
              <div className={`h-3.5 w-20 ${BAR}`} />
            </div>
            <div className="flex w-10 shrink-0 justify-center">
              <div className={`h-4 w-4 ${BAR}`} />
            </div>
          </li>
        ))}
      </ul>
    </output>
  );
}

const noop = () => undefined;

/** The page's "New" menu, inert until the page is ready. */
export function ExplorerNewMenuSkeleton({
  t,
}: Readonly<{ t: (key: string) => string }>) {
  return (
    <ExplorerNewMenu
      newLabel={t("new")}
      newFileLabel={t("newFile")}
      newFolderLabel={t("newFolder")}
      onNewFile={noop}
      onNewFolder={noop}
      createDisabled
    />
  );
}

/**
 * The list before the organization is known. The column header is the real
 * one, inert, so nothing moves when the page takes over; only the rows are
 * placeholders.
 */
export function ExplorerPageSkeleton({
  t,
  label,
}: Readonly<{ t: (key: string) => string; label: string }>) {
  return (
    <div className={LIST_FRAME_CLASS}>
      <ExplorerHeader
        t={t}
        tags={[]}
        facets={NO_FACETS}
        onFacetsChange={noop}
      />
      <ExplorerSkeletonRows label={label} />
    </div>
  );
}
