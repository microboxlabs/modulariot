import type { SonarIssue } from "../types.js";

function fileFromComponent(component: string): string {
  const parts = component.split(":");
  return parts[parts.length - 1]!;
}

export function formatIssuesList(issues: SonarIssue[]): string {
  return issues
    .map(
      (issue) =>
        `${issue.severity}\t${issue.rule}\t${fileFromComponent(issue.component)}:${issue.line ?? "?"}\t${issue.message}`,
    )
    .join("\n");
}
