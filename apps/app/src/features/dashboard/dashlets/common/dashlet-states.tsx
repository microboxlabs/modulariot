"use client";

import { Spinner } from "flowbite-react";

/**
 * Standard loading state for dashlet components during PGREST data fetching.
 */
export function DashletLoading() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <Spinner size="sm" />
    </div>
  );
}

/**
 * Standard error state for dashlet components when PGREST fetch fails.
 */
export function DashletError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
      <span className="text-xs text-red-600 dark:text-red-400">{message}</span>
    </div>
  );
}

/**
 * Parse a resolved Handlebars field value as a number.
 * Returns `fallback` if the value is empty, null, or not a finite number.
 */
export function parseResolvedNumber(raw: string | undefined | null, fallback = 0): number {
  if (raw === "" || raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
