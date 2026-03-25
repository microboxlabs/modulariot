# @microboxlabs/sonarcloud-tools

CLI and programmatic API for fetching SonarCloud issues and rule documentation.

## Setup

Set `SONAR_TOKEN` in your environment (or pass `-t TOKEN` to each command):

```bash
export SONAR_TOKEN=your_token_here
```

Get a token from [SonarCloud → Account → Security](https://sonarcloud.io/account/security).

## CLI usage

### Issues

Fetch open SonarCloud issues for a project.

```bash
# List issues for current PR (auto-detect)
npx @microboxlabs/sonarcloud-tools issues --pr

# LLM-friendly output with rule documentation
npx @microboxlabs/sonarcloud-tools issues --pr -o context --with-docs

# Filter by branch
npx @microboxlabs/sonarcloud-tools issues --branch-current
npx @microboxlabs/sonarcloud-tools issues -b feature/my-branch

# Filter by severity
npx @microboxlabs/sonarcloud-tools issues --pr -s CRITICAL,BLOCKER
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --token <token>` | SonarCloud token | `SONAR_TOKEN` env |
| `-k, --project-key <key>` | SonarCloud project key (required) | |
| `-b, --branch <branch>` | Filter by branch name | |
| `--branch-current` | Auto-detect current git branch | |
| `-p, --pull-request <number>` | Filter by PR number | |
| `--pr` | Auto-detect PR number | |
| `-s, --severities <list>` | Comma-separated severity filter | all |
| `-o, --output <format>` | `list` or `context` | `list` |
| `--with-docs` | Append rule docs (with `-o context`) | |

**Output formats:**

- `list` — tab-separated table: `SEVERITY  RULE  FILE:LINE  MESSAGE`
- `context` — one block per issue with File, Line, Rule, Severity, Message (good for LLM consumption)

### Rule documentation

Fetch documentation for a specific SonarCloud rule.

```bash
npx @microboxlabs/sonarcloud-tools rule-doc typescript:S1192
npx @microboxlabs/sonarcloud-tools rule-doc typescript:S1192 -o md
npx @microboxlabs/sonarcloud-tools rule-doc typescript:S1192 -o url
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --token <token>` | SonarCloud token | `SONAR_TOKEN` env |
| `-g, --organization <org>` | SonarCloud organization | `microboxlabs` |
| `-o, --output <format>` | `text`, `md`, `json`, or `url` | `text` |

## Monorepo usage

From the repository root:

```bash
# Via npm scripts
npm run sonarcloud:issues -- --pr -o context --with-docs
npm run sonarcloud:rule-doc -- typescript:S1192

# Directly
node packages/sonarcloud-tools/dist/cli.js issues --pr
node packages/sonarcloud-tools/dist/cli.js rule-doc typescript:S1192
```

Build the package:

```bash
npx turbo run build --filter=@microboxlabs/sonarcloud-tools
```

## Programmatic API

```typescript
import { fetchIssues, fetchRule, formatIssuesContext, formatRuleText } from "@microboxlabs/sonarcloud-tools";

const issues = await fetchIssues({
  token: process.env.SONAR_TOKEN!,
  projectKey: "your_project_key",
  pullRequest: "16",
});

console.log(formatIssuesContext(issues.issues));

const rule = await fetchRule({
  token: process.env.SONAR_TOKEN!,
  ruleKey: "typescript:S1192",
  organization: "microboxlabs",
});

console.log(formatRuleText(rule.rule));
```

## PR auto-detection

The `--pr` flag detects the PR number from (in order):

1. `gh pr view` (GitHub CLI)
2. `GITHUB_REF` (GitHub Actions)
3. `CI_MERGE_REQUEST_IID` (GitLab CI)
4. `SYSTEM_PULLREQUEST_PULLREQUESTID` (Azure DevOps)
5. `BITBUCKET_PR_ID` (Bitbucket Pipelines)

## Publishing

Publishing is handled by the `publish-sonarcloud-tools` GitHub workflow, triggered by:

- Tag push matching `sonarcloud-tools/v*`
- Manual `workflow_dispatch` with version input

Requires an `NPM_TOKEN` secret in the repository settings.
