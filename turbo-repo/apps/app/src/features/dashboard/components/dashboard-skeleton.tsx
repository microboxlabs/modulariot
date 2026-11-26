/**
 * What a dashboard looks like while it loads: grey blocks where the header
 * and the dashlets will be, instead of a "Loading…" line. The text stays for
 * screen readers only.
 */

const BLOCK = "animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700";

/** Dashlet-shaped blocks on the dashboard's 24-column grid. */
export function DashboardGridSkeleton() {
  return (
    <div
      aria-hidden
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(24, minmax(0, 1fr))",
        gridAutoRows: "minmax(150px, 1fr)",
      }}
    >
      <div className={`col-span-12 ${BLOCK}`} />
      <div className={`col-span-12 ${BLOCK}`} />
      <div className={`col-span-8 ${BLOCK}`} />
      <div className={`col-span-8 ${BLOCK}`} />
      <div className={`col-span-8 ${BLOCK}`} />
      <div className={`col-span-16 ${BLOCK}`} />
      <div className={`col-span-8 ${BLOCK}`} />
    </div>
  );
}

/** A whole dashboard page: header bar, then the grid. */
export function DashboardSkeleton({ label }: Readonly<{ label: string }>) {
  return (
    <output
      aria-busy="true"
      className="flex h-full w-full flex-col overflow-hidden"
    >
      <span className="sr-only">{label}</span>
      <div
        aria-hidden
        className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-4 dark:border-gray-700"
      >
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-3 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
      <div className="min-h-0 flex-1 p-4">
        <DashboardGridSkeleton />
      </div>
    </output>
  );
}
