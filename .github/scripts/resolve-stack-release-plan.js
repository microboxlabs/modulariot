#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");

const repo = process.env.GITHUB_REPOSITORY;
const milestone = process.env.OSS_MILESTONE;
const stackVersion = process.env.STACK_VERSION;
const outputPath = process.env.GITHUB_OUTPUT;

if (!repo || !milestone || !stackVersion || !outputPath) {
  throw new Error("GITHUB_REPOSITORY, OSS_MILESTONE, STACK_VERSION, and GITHUB_OUTPUT are required.");
}

const run = (command, args) =>
  execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

const latestVersion = (pattern, prefix) => {
  const tags = run("git", ["tag", "--list", pattern])
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(prefix, ""));

  if (tags.length === 0) return "";
  return tags.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[tags.length - 1];
};

const bumpPatch = (version) => {
  if (!version) return "0.1.0";
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid semver tag version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};

const prListJson = run("gh", [
  "pr",
  "list",
  "--repo",
  repo,
  "--state",
  "merged",
  "--search",
  `milestone:"${milestone}"`,
  "--json",
  "number,title",
  "--limit",
  "200",
]);

const issueListJson = run("gh", [
  "issue",
  "list",
  "--repo",
  repo,
  "--milestone",
  milestone,
  "--state",
  "all",
  "--json",
  "number,title,closedByPullRequestsReferences",
  "--limit",
  "200",
]);

const prByNumber = new Map();
for (const pr of JSON.parse(prListJson)) {
  prByNumber.set(pr.number, { ...pr, source_issues: [] });
}

for (const issue of JSON.parse(issueListJson)) {
  for (const pr of issue.closedByPullRequestsReferences ?? []) {
    if (pr.repository?.owner?.login !== repo.split("/")[0] || pr.repository?.name !== repo.split("/")[1]) {
      continue;
    }

    const existing = prByNumber.get(pr.number) ?? {
      number: pr.number,
      title: "",
      source_issues: [],
    };
    existing.source_issues.push({ number: issue.number, title: issue.title });
    prByNumber.set(pr.number, existing);
  }
}

const prs = [...prByNumber.values()].sort((a, b) => a.number - b.number);
const changedFiles = new Set();

for (const pr of prs) {
  const prJson = run("gh", ["pr", "view", String(pr.number), "--repo", repo, "--json", "title,files"]);
  const prData = JSON.parse(prJson);
  pr.title = pr.title || prData.title;
  const files = prData.files ?? [];
  for (const file of files) {
    if (file.path) changedFiles.add(file.path);
  }
}

const pathStarts = (prefixes) => [...changedFiles].some((file) => prefixes.some((prefix) => file.startsWith(prefix)));

// Stack release notes are bundled into the Next.js app, so the app package,
// tag, and image intentionally stay in sync with the stack version.
const appChanged = true;
const modulithChanged = pathStarts(["quarkus-srv/"]);

const latestModulithVersion = latestVersion("modulith@v*", "modulith@v");
const latestHarnessVersion = latestVersion("harness@v*", "harness@v");
const harnessChanged = pathStarts(["miot-harness/"]) || !latestHarnessVersion;
const appVersion = stackVersion;
const modulithVersion = modulithChanged ? bumpPatch(latestModulithVersion) : latestModulithVersion;
const harnessVersion = harnessChanged ? bumpPatch(latestHarnessVersion) : latestHarnessVersion;

if (!appVersion) {
  throw new Error("No app@v* tag exists and the app did not change in this milestone.");
}
if (!modulithVersion) {
  throw new Error("No modulith@v* tag exists and the modulith did not change in this milestone.");
}
if (!harnessVersion) {
  throw new Error("No harness@v* tag exists and the harness did not change in this milestone.");
}
const plan = {
  stack_version: stackVersion,
  stack_tag: `miot-stack@v${stackVersion}`,
  milestone,
  pull_requests: prs,
  changed_files: [...changedFiles].sort(),
  components: {
    app: {
      changed: appChanged,
      version: appVersion,
      tag: `app@v${appVersion}`,
    },
    modulith: {
      changed: modulithChanged,
      version: modulithVersion,
      tag: `modulith@v${modulithVersion}`,
    },
    harness: {
      changed: harnessChanged,
      version: harnessVersion,
      tag: `harness@v${harnessVersion}`,
    },
  },
};

fs.mkdirSync("releases/stacks", { recursive: true });
const planFile = `releases/stacks/v${stackVersion}.plan.json`;
fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);

const outputs = {
  app_changed: String(appChanged),
  app_version: appVersion,
  app_tag: plan.components.app.tag,
  modulith_changed: String(modulithChanged),
  modulith_version: modulithVersion,
  modulith_tag: plan.components.modulith.tag,
  harness_changed: String(harnessChanged),
  harness_version: harnessVersion,
  harness_tag: plan.components.harness.tag,
  stack_tag: plan.stack_tag,
  stack_plan_file: planFile,
};

fs.appendFileSync(outputPath, Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
