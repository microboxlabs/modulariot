"use client";
import type { CSSProperties } from "react";
import { evaluateRule, type ColorRuleOperator } from "../core/color-rules";
export interface CellColorRule {
  operator: ColorRuleOperator;
  value: string;
  color: string;
}
export interface TableCellValueProps {
  value: string;
  type?: string;
  colorMap?: readonly CellColorRule[];
  progressLabel?: string;
}
const namedColors: Record<string, string> = {
  red: "ef4444",
  yellow: "eab308",
  green: "22c55e",
  blue: "3b82f6",
  gray: "6b7280",
  orange: "f97316",
  purple: "a855f7",
};
function colorValue(color: string) {
  if (/^[\da-f]{6}$/i.test(color)) return `#${color}`;
  return Object.hasOwn(namedColors, color)
    ? `#${namedColors[color]}`
    : undefined;
}
function matchedRule(
  rules: readonly CellColorRule[] | undefined,
  value: string,
) {
  if (!Array.isArray(rules)) return undefined;
  return rules.find(
    (rule) =>
      rule &&
      typeof rule.color === "string" &&
      colorValue(rule.color) &&
      typeof rule.value === "string" &&
      evaluateRule({ ...rule, column: "" }, value),
  );
}
function signedTone(value: string) {
  const parsed = Number.parseFloat(value.replaceAll(/[^\d.-]/g, ""));
  if (!Number.isFinite(parsed)) return "neutral";
  if (parsed < 0) return "negative";
  return parsed < 1000 ? "small" : "positive";
}
/** Literal, styled cell content. It never evaluates HTML, links, queries or templates. */
export function TableCellValue({
  value,
  type = "text",
  colorMap,
  progressLabel,
}: Readonly<TableCellValueProps>) {
  const match = matchedRule(colorMap, value);
  const color = match ? colorValue(match.color) : undefined;
  const style: CSSProperties & { "--miot-cell-color"?: string } = {
    "--miot-cell-color": color,
  };
  if (type === "badge")
    return (
      <span
        className="miot-table-cell__badge"
        data-color={match?.color}
        data-custom-color={
          (!!match && !Object.hasOwn(namedColors, match.color)) || undefined
        }
        style={style}
      >
        {value}
      </span>
    );
  if (type === "signed")
    return (
      <span
        className="miot-table-cell__signed"
        data-tone={signedTone(value)}
        style={{ color }}
      >
        {value}
      </span>
    );
  if (type === "progress") {
    const parsed = Number.parseFloat(value.replaceAll(/[^\d.-]/g, ""));
    const percentage = Number.isFinite(parsed)
      ? Math.min(100, Math.max(0, parsed))
      : 0;
    let fallback = "#ef4444";
    if (percentage >= 90) fallback = "#22c55e";
    else if (percentage >= 80) fallback = "#fb923c";
    const progressStyle: CSSProperties & { "--miot-cell-color": string } = {
      "--miot-cell-color": color ?? fallback,
    };
    return (
      <span className="miot-table-cell__progress" style={progressStyle}>
        <progress
          max={100}
          value={percentage}
          aria-label={progressLabel || value || "0%"}
          aria-valuetext={value || "0%"}
        />
        <span style={{ color }}>{value}</span>
      </span>
    );
  }
  const lines = value.split("\n");
  if (lines.length > 1)
    return (
      <span className="miot-table-cell__multiline" style={{ color }}>
        <strong>{lines[0]}</strong>
        <small>{lines.slice(1).join(" ")}</small>
      </span>
    );
  return <span style={{ color }}>{value}</span>;
}
/** Compatibility function for existing table/list cell slots. */
export function renderCell(
  value: string,
  type: string,
  colorMap?: readonly CellColorRule[],
) {
  return <TableCellValue value={value} type={type} colorMap={colorMap} />;
}
