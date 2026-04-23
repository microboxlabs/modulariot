import { isColumnType } from "./column-types";
import type { BadgeColorMapping } from "./column-types";
import {
  getBadgeColorClassesByRule,
  getBadgeColorStyles,
  getColorDotClass,
  getColorDotStyles,
  evaluateRule,
} from "./color-rule-engine";

// ============================================================================
// Color rule matching helper
// ============================================================================

function findMatchingRule(
  colorMap: BadgeColorMapping[] | undefined,
  value: string
): BadgeColorMapping | undefined {
  if (!Array.isArray(colorMap)) return undefined;
  return colorMap.find((m) =>
    evaluateRule(
      { column: "", operator: m.operator, value: m.value, color: m.color },
      value
    )
  );
}

function isHexColor(color: string): boolean {
  return /^[0-9a-fA-F]{6}$/.test(color);
}

const LEGACY_COLOR_MAP: Record<string, string> = {
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  gray: "#6b7280",
  orange: "#f97316",
  purple: "#a855f7",
};

function resolveColorValue(color: string): string | undefined {
  if (isHexColor(color)) return `#${color}`;
  return LEGACY_COLOR_MAP[color];
}

// ============================================================================
// Badge rendering (with transparency styling)
// ============================================================================

const DEFAULT_BADGE_CLASSES =
  "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";

function renderBadge(
  value: string,
  match: BadgeColorMapping | undefined
): React.ReactNode {
  if (match) {
    const legacyClasses = getBadgeColorClassesByRule(match.color);
    const hexStyles = getBadgeColorStyles(match.color);
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${legacyClasses}`}
        style={hexStyles}
      >
        {value}
      </span>
    );
  }
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DEFAULT_BADGE_CLASSES}`}
    >
      {value}
    </span>
  );
}

// ============================================================================
// Progress rendering
// ============================================================================

export function getProgressColor(pct: number): string {
  if (pct >= 90) return "bg-green-500";
  if (pct >= 80) return "bg-orange-400";
  return "bg-red-500";
}

function renderProgress(
  value: string,
  match: BadgeColorMapping | undefined
): React.ReactNode {
  const pct = Number.parseFloat(value.replaceAll(/[^\d.]/g, ""));
  const safePct = Number.isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));

  // User-set rule overrides the base ruleset
  const barColorClass = match ? getColorDotClass(match.color) : getProgressColor(safePct);
  const barColorStyle = match ? getColorDotStyles(match.color) : undefined;
  const textColor = match ? resolveColorValue(match.color) : undefined;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-2 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
        <span
          className={`block h-full rounded-full ${barColorClass}`}
          style={{ width: `${safePct}%`, ...barColorStyle }}
        />
      </span>
      <span
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
        style={textColor ? { color: textColor } : undefined}
      >
        {value}
      </span>
    </span>
  );
}

// ============================================================================
// Signed rendering
// ============================================================================

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

function renderSigned(
  value: string,
  match: BadgeColorMapping | undefined
): React.ReactNode {
  const matchedColor = match ? resolveColorValue(match.color) : undefined;
  if (matchedColor) {
    return (
      <span className="font-semibold" style={{ color: matchedColor }}>
        {value}
      </span>
    );
  }
  return <span className={getSignedClasses(value)}>{value}</span>;
}

// ============================================================================
// Text rendering (also handles deprecated "highlight")
// ============================================================================

function renderText(
  value: string,
  match: BadgeColorMapping | undefined
): React.ReactNode {
  const matchedColor = match ? resolveColorValue(match.color) : undefined;
  const colorStyle: React.CSSProperties | undefined = matchedColor
    ? { color: matchedColor }
    : undefined;

  const lines = value.split("\n");
  if (lines.length > 1) {
    return (
      <span style={colorStyle}>
        <span className="block font-semibold text-gray-900 dark:text-white">
          {lines[0]}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {lines.slice(1).join(" ")}
        </span>
      </span>
    );
  }
  return <span style={colorStyle}>{value}</span>;
}

// ============================================================================
// Main render function
// ============================================================================

export function renderCell(
  value: string,
  type: string,
  colorMap?: BadgeColorMapping[]
) {
  const resolved = isColumnType(type) ? type : "text";
  const match = findMatchingRule(colorMap, value);

  if (resolved === "badge") return renderBadge(value, match);
  if (resolved === "signed") return renderSigned(value, match);
  if (resolved === "progress") return renderProgress(value, match);
  return renderText(value, match);
}
