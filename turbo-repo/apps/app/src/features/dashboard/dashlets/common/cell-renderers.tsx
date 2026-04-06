import { isColumnType } from "./column-types";
import type { BadgeColorMapping } from "./column-types";
import { getBadgeColorClassesByRule, evaluateRule } from "./color-rule-engine";

export function getBadgeClasses(value: string): string {
  const lower = value.toLowerCase();
  if (
    lower.includes("crít") ||
    lower.includes("critical") ||
    lower.includes("error") ||
    lower.includes("alto")
  ) {
    return "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
  }
  if (
    lower.includes("medio") ||
    lower.includes("medium") ||
    lower.includes("warning") ||
    lower.includes("advertencia")
  ) {
    return "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
  }
  if (lower.includes("bajo") || lower.includes("low")) {
    return "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
  }
  if (
    lower.includes("ok") ||
    lower.includes("activo") ||
    lower.includes("active") ||
    lower.includes("success")
  ) {
    return "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
  }
  return "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
}

export function getProgressColor(pct: number): string {
  if (pct >= 90) return "bg-green-500";
  if (pct >= 80) return "bg-orange-400";
  return "bg-red-500";
}

export function renderProgress(value: string) {
  const pct = Number.parseFloat(value.replaceAll(/[^\d.]/g, ""));
  const safePct = Number.isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  const barColor = getProgressColor(safePct);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-2 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
        <span
          className={`block h-full rounded-full ${barColor}`}
          style={{ width: `${safePct}%` }}
        />
      </span>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {value}
      </span>
    </span>
  );
}

export function getSignedClasses(value: string): string {
  const numeric = Number.parseFloat(value.replaceAll(/[^\d.-]/g, ""));
  if (Number.isNaN(numeric)) {
    return "text-gray-700 dark:text-gray-300";
  }
  if (numeric < 0) {
    return "font-semibold text-red-600 dark:text-red-400";
  }
  if (numeric < 1000) {
    return "font-semibold text-orange-500 dark:text-orange-400";
  }
  return "font-semibold text-green-600 dark:text-green-400";
}

export function renderCell(value: string, type: string, colorMap?: BadgeColorMapping[]) {
  const resolved = isColumnType(type) ? type : "text";
  if (resolved === "text") {
    // text — multiline: first line bold, rest as muted subtitle
    const lines = value.split("\n");
    if (lines.length > 1) {
      return (
        <span>
          <span className="block font-semibold text-gray-900 dark:text-white">
            {lines[0]}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {lines.slice(1).join(" ")}
          </span>
        </span>
      );
    }
    return <span>{value}</span>;
  }
  if (resolved === "badge") {
    const match = colorMap?.find((m) =>
      evaluateRule({ column: "", operator: m.operator, value: m.value, color: m.color }, value),
    );
    const badgeClasses = match
      ? getBadgeColorClassesByRule(match.color)
      : getBadgeClasses(value);
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses}`}
      >
        {value}
      </span>
    );
  }
  if (resolved === "highlight") {
    return (
      <span className="font-semibold text-blue-600 dark:text-blue-400">
        {value}
      </span>
    );
  }
  if (resolved === "signed") {
    return <span className={getSignedClasses(value)}>{value}</span>;
  }
  // progress
  return renderProgress(value);
}
