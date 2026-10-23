import type { ReactNode } from "react";

/** A header chip: a placeholder while loading, then the value or a dash. */
export function chipText(
  loading: boolean,
  value: string | null | undefined,
  label?: string
): ReactNode {
  if (loading) {
    return (
      <div className="bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md">
        ejemplo
      </div>
    );
  }
  const text = value || "—";
  return label ? `${label}: ${text}` : text;
}
