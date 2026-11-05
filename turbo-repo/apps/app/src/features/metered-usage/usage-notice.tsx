import type { ReactNode } from "react";
import { HiInformationCircle } from "react-icons/hi2";

/**
 * A notice above the usage cards: `info` (blue, e.g. quotas not applied),
 * `danger` (red, quota used up), `warning` (amber), `error` (load failed).
 */
export default function UsageNotice({
  tone,
  children,
}: Readonly<{
  tone: "info" | "danger" | "warning" | "error";
  children: ReactNode;
}>) {
  if (tone === "info") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-900/20">
        <HiInformationCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-blue-800 dark:text-blue-300">{children}</p>
      </div>
    );
  }
  if (tone === "danger") {
    return (
      <output className="block rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
        {children}
      </output>
    );
  }
  if (tone === "warning") {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
        {children}
      </p>
    );
  }
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
      {children}
    </p>
  );
}
