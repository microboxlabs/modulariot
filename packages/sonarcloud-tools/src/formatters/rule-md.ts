import type { SonarRule } from "../types.js";
import { ruleUrl } from "./rule-text.js";

export function formatRuleMd(rule: SonarRule): string {
  const desc = rule.mdDesc ?? rule.htmlDesc ?? rule.description ?? "";
  const lines = [
    `# ${rule.key}: ${rule.name}`,
    `Severity: ${rule.severity ?? "N/A"} | Type: ${rule.type ?? "N/A"}`,
    `URL: ${ruleUrl(rule.key)}`,
    "",
    desc,
  ];
  return lines.join("\n");
}
