import type { SonarIssue } from "../types.js";

function fileFromComponent(component: string): string {
  const parts = component.split(":");
  return parts.at(-1) ?? component;
}

export function formatIssuesContext(issues: SonarIssue[]): string {
  return issues
    .map(
      (issue) =>
        `---\nFile: ${fileFromComponent(issue.component)}\nLine: ${issue.line ?? "?"}\nRule: ${issue.rule}\nSeverity: ${issue.severity}\nMessage: ${issue.message}\n`,
    )
    .join("\n");
}
