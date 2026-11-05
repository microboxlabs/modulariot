import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { IconTile } from "@/features/common/components/icon-tile/icon-tile";
import QuotaBar from "./quota-bar";

const cardClass =
  "flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";
const cardHeaderClass =
  "flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700";
const cardTitleClass =
  "text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white";
const footerClass =
  "border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400";

/** One card of a "Uso del mes" view: icon, title, body and an optional footer. */
export function UsageCard({
  icon,
  title,
  description,
  bodyClassName = "flex-1 px-4 py-3",
  footer,
  children,
}: Readonly<{
  icon: IconType;
  title: string;
  description?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <IconTile icon={icon} />
        <div className="min-w-0 flex-1">
          <h2 className={cardTitleClass}>{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className={bodyClassName}>{children}</div>
      {footer && <div className={footerClass}>{footer}</div>}
    </section>
  );
}

/** The card's main number. */
export function UsageNumber({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
      {children}
    </p>
  );
}

/** A labelled amount, two to a card. */
export function UsageFigure({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

/**
 * Used against the quota with its bar. Without a quota it says `unavailable`
 * and shows no number.
 */
export function UsageQuotaCard({
  icon,
  title,
  description,
  used,
  quota,
  unit,
  alertPct,
  unavailable,
  footer,
}: Readonly<{
  icon: IconType;
  title: string;
  description: string;
  used: number;
  quota: number | null;
  unit: string;
  alertPct: number;
  unavailable: string;
  footer: ReactNode;
}>) {
  if (quota === null) {
    return (
      <section className={cardClass}>
        <div className="px-4 py-5">
          <h2 className={cardTitleClass}>{title}</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {unavailable}
          </p>
        </div>
      </section>
    );
  }
  return (
    <UsageCard
      icon={icon}
      title={title}
      description={description}
      footer={footer}
    >
      <p className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {used.toLocaleString()}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          / {quota.toLocaleString()} {unit}
        </span>
      </p>
      <QuotaBar
        used={used}
        quota={quota}
        alertPct={alertPct}
        className="mt-2"
      />
    </UsageCard>
  );
}

export interface BreakdownColumn {
  label: string;
  align?: "right";
}

export interface BreakdownRow {
  key: string;
  cells: readonly ReactNode[];
}

/** A card with a small table, e.g. usage by source or by destination. */
export function UsageBreakdownCard({
  icon,
  title,
  empty,
  columns,
  rows,
}: Readonly<{
  icon: IconType;
  title: string;
  empty: string;
  columns: readonly BreakdownColumn[];
  rows: readonly BreakdownRow[];
}>) {
  const align = (c: BreakdownColumn) =>
    c.align === "right" ? "text-right" : "";
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <IconTile icon={icon} />
        <h2 className={cardTitleClass}>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.label}
                    className={`px-4 py-2 font-medium ${align(c)}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-t border-gray-100 dark:border-gray-700"
                >
                  {row.cells.map((cell, i) => (
                    <td
                      key={columns[i]?.label ?? i}
                      className={`px-4 py-2 ${align(columns[i] ?? { label: "" })}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
