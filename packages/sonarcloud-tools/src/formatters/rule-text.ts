import type { SonarRule } from "../types.js";
import { cleanHtmlToText } from "./html-utils.js";

export function ruleUrl(ruleKey: string): string {
  return `https://sonarcloud.io/coding_rules?open=${encodeURIComponent(ruleKey)}`;
}

export function formatRuleText(rule: SonarRule): string {
  const desc = rule.mdDesc ?? rule.htmlDesc ?? rule.description ?? "";
  const lines = [
    `Rule: ${rule.key}`,
    `Name: ${rule.name}`,
    `Severity: ${rule.severity ?? "N/A"} | Type: ${rule.type ?? "N/A"}`,
    `URL: ${ruleUrl(rule.key)}`,
    "---",
    cleanHtmlToText(desc),
    "",
  ];
  return lines.join("\n");
}
