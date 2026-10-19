import type { ReactNode } from "react";

export const MUTED = "text-gray-500 dark:text-gray-400";

export function Card({
  className = "",
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <div
      className={`flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {children}
    </div>
  );
}

/** The square badge at the start of a card header. */
export function Tile({
  className = "",
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  tile,
  title,
  subtitle,
  children,
}: Readonly<{
  tile: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}>) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      {tile}
      <div className="min-w-0">
        <div className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {title}
        </div>
        {subtitle && <div className={`text-xs ${MUTED}`}>{subtitle}</div>}
      </div>
      {children && (
        <div className="ml-auto flex items-center gap-2">{children}</div>
      )}
    </div>
  );
}

export function CardFooter({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div
      className={`border-t border-gray-100 px-4 py-3 text-xs dark:border-gray-700/60 ${MUTED}`}
    >
      {children}
    </div>
  );
}
