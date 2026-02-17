import { execSync } from "node:child_process";

export function detectPullRequest(): string {
  // Try gh CLI first
  try {
    const pr = execSync("gh pr view --json number -q .number", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (pr) return pr;
  } catch {
    // gh not available or not in a PR
  }

  // GitHub Actions: refs/pull/123/merge
  const githubRef = process.env.GITHUB_REF;
  if (githubRef) {
    const match = githubRef.match(/^refs\/pull\/(\d+)\//);
    if (match?.[1]) return match[1];
  }

  // GitLab CI
  if (process.env.CI_MERGE_REQUEST_IID) {
    return process.env.CI_MERGE_REQUEST_IID;
  }

  // Azure DevOps
  if (process.env.SYSTEM_PULLREQUEST_PULLREQUESTID) {
    return process.env.SYSTEM_PULLREQUEST_PULLREQUESTID;
  }

  // Bitbucket Pipelines
  if (process.env.BITBUCKET_PR_ID) {
    return process.env.BITBUCKET_PR_ID;
  }

  throw new Error(
    "Could not detect PR (install gh, or run from CI, or use -p PR_NUMBER)",
  );
}
