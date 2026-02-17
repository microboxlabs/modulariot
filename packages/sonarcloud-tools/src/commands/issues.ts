import type { Command } from "commander";
import { fetchIssues } from "../api/issues-api.js";
import { fetchRule } from "../api/rules-api.js";
import type { SonarIssue } from "../types.js";
import { detectBranch } from "../detect/branch.js";
import { detectPullRequest } from "../detect/pull-request.js";
import { formatIssuesContext } from "../formatters/issues-context.js";
import { formatIssuesList } from "../formatters/issues-list.js";
import { formatRuleText } from "../formatters/rule-text.js";

function resolveToken(opts: { token?: string }): string {
  const token = opts.token ?? process.env.SONAR_TOKEN;
  if (!token) {
    console.error("Error: Set SONAR_TOKEN or pass -t TOKEN");
    process.exit(1);
  }
  return token;
}

function buildScopeLabel(pullRequest?: string, branch?: string): string {
  const parts: string[] = [];
  if (pullRequest) parts.push(`pullRequest: ${pullRequest}`);
  if (branch) parts.push(`branch: ${branch}`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

async function printRuleDocs(
  issues: SonarIssue[],
  token: string,
): Promise<void> {
  const uniqueRules = [...new Set(issues.map((i) => i.rule))];
  console.log("");
  console.log("=== Rule documentation ===");
  for (const ruleKey of uniqueRules) {
    console.log("");
    console.log(`--- Rule: ${ruleKey} ---`);
    try {
      const ruleData = await fetchRule({
        token,
        ruleKey,
        organization: "microboxlabs",
      });
      console.log(formatRuleText(ruleData.rule));
    } catch {
      console.log(`(could not fetch documentation for ${ruleKey})`);
    }
  }
}

export function registerIssuesCommand(program: Command): void {
  program
    .command("issues")
    .description("Fetch open SonarCloud issues for a project")
    .option(
      "-t, --token <token>",
      "SonarCloud token (default: SONAR_TOKEN env)",
    )
    .requiredOption(
      "-k, --project-key <key>",
      "SonarCloud project key",
    )
    .option("-b, --branch <branch>", "Filter by branch name")
    .option("--branch-current", "Auto-detect current git branch")
    .option("-p, --pull-request <number>", "Filter by PR number")
    .option("--pr", "Auto-detect PR number")
    .option("-s, --severities <list>", "Comma-separated severity filter")
    .option("-o, --output <format>", "list | context", "list")
    .option(
      "--with-docs",
      "Append rule docs (with -o context)",
    )
    .action(async (opts) => {
      const token = resolveToken(opts);
      const branch = opts.branchCurrent ? detectBranch() : opts.branch;
      const pullRequest = opts.pr ? detectPullRequest() : opts.pullRequest;

      const data = await fetchIssues({
        token,
        projectKey: opts.projectKey,
        branch,
        pullRequest,
        severities: opts.severities,
      });

      const scope = buildScopeLabel(pullRequest, branch);
      console.log(
        `=== SonarCloud issues (open): ${data.total} === project: ${opts.projectKey}${scope}`,
      );
      console.log("");

      if (data.total === 0) {
        console.log("(no open issues)");
        return;
      }

      if (opts.output !== "context") {
        console.log(formatIssuesList(data.issues));
        return;
      }

      console.log(formatIssuesContext(data.issues));

      if (opts.withDocs) {
        await printRuleDocs(data.issues, token);
      } else {
        console.log(
          "Tip: fetch rule docs with: npx @microboxlabs/sonarcloud-tools rule-doc <Rule> or use --with-docs",
        );
      }
    });
}
