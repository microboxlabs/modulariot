import type { ReactNode } from "react";

export function MetaRow({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="text-xs text-gray-700 dark:text-gray-200 wrap-break-word">{value}</dd>
    </div>
  );
}
