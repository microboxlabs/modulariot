import type { ReactNode } from "react";

/** The full-width filter row under the breadcrumb bar, as in the dashboards, the kanban and the control tower. */
export default function FilterStrip({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-900">
      {children}
    </div>
  );
}
