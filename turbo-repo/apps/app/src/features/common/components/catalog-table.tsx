import type { ReactNode } from "react";

/** The list layout of a settings catalog: a header row of `columns`, then the rows. */
export default function CatalogTable({
  columns,
  children,
}: Readonly<{ columns: string[]; children: ReactNode }>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-2">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
