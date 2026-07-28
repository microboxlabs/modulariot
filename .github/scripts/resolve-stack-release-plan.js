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

const semverPattern = /^(\d+)\.(\d+)\.(\d+)$/;

const assertSemver = (version, source) => {
  if (!semverPattern.test(version)) {
    throw new Error(`Invalid semver version from ${source}: ${version}`);
  }
  return version;
};

const maxVersion = (...versions) => {
  const validVersions = versions.filter(Boolean).map((version) => assertSemver(version, "version source"));
  if (validVersions.length === 0) return "";
  return validVersions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
};

const projectVersion = (path) => {
  const content = fs.readFileSync(path, "utf8");
  const match = content.match(/^version = "([^"]+)"$/m);
  if (!match) {
    throw new Error(`Could not read project.version from ${path}`);
  }
  return assertSemver(match[1], path);
};

const bumpPatch = (version) => {
  if (!version) return "0.1.0";
  const match = assertSemver(version, "tag").match(semverPattern);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};

// An absent milestone makes every `gh` query below return an empty set, which used to
// plan a silent no-change release: every component fell back to its last released tag.
const milestoneTitles = run("gh", [
  "api",
  "--paginate",
  `repos/${repo}/milestones?state=all&per_page=100`,
  "--jq",
  ".[].title",
])
  .split("\n")
  .map((title) => title.trim());

if (!milestoneTitles.includes(milestone)) {
  throw new Error(
    `Milestone ${milestone} does not exist in ${repo}. Create it and attach this release's issues before running the release train.`,
  );
}

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

if (prs.length === 0) {
  throw new Error(
    `Milestone ${milestone} has no merged pull requests. Attach the release's PRs, or the issues they closed, to the milestone before running the release train.`,
  );
}

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

// Change detection compares the tree against each component's last released tag rather
// than against the milestone's file set. Work merged to trunk without being attached to
// the milestone is invisible to `gh`, and treating that as "unchanged" pins the component
// to its last tag and reships a stale image.
const changedSince = (baselineTag, prefixes) => {
  if (!baselineTag) return true;
  return run("git", ["diff", "--name-only", `${baselineTag}..HEAD`, "--", ...prefixes]).length > 0;
};

const latestDocsVersion = latestVersion("docs@v*", "docs@v");
const latestWebVersion = latestVersion("web@v*", "web@v");
const latestModulithVersion = latestVersion("modulith@v*", "modulith@v");
const latestHarnessVersion = latestVersion("harness@v*", "harness@v");

const docsBaseline = latestDocsVersion ? `docs@v${latestDocsVersion}` : "";
const webBaseline = latestWebVersion ? `web@v${latestWebVersion}` : "";
const modulithBaseline = latestModulithVersion ? `modulith@v${latestModulithVersion}` : "";
const harnessBaseline = latestHarnessVersion ? `harness@v${latestHarnessVersion}` : "";

// Stack release notes are bundled into the Next.js app, so the app package,
// tag, and image intentionally stay in sync with the stack version.
const appChanged = true;
const docsChanged = changedSince(docsBaseline, [
  "turbo-repo/apps/docs/",
  "turbo-repo/packages/ui/",
  "turbo-repo/packages/typescript-config/",
  "turbo-repo/packages/eslint-config/",
  "turbo-repo/package-lock.json",
  "turbo-repo/docker/nextjs.standalone-docs.Dockerfile",
]);
const webChanged = changedSince(webBaseline, [
  "turbo-repo/apps/web/",
  "turbo-repo/packages/typescript-config/",
  "turbo-repo/packages/eslint-config/",
  "turbo-repo/package-lock.json",
  "turbo-repo/docker/nextjs.standalone.Dockerfile",
]);
const modulithChanged = changedSince(modulithBaseline, ["quarkus-srv/"]);
const harnessChanged = changedSince(harnessBaseline, ["miot-harness/"]);

const currentHarnessVersion = projectVersion("miot-harness/pyproject.toml");
const harnessBaseVersion = maxVersion(latestHarnessVersion, currentHarnessVersion);
const appVersion = stackVersion;
const docsVersion = docsChanged ? stackVersion : latestDocsVersion;
const webVersion = webChanged ? stackVersion : latestWebVersion;
const modulithVersion = modulithChanged ? bumpPatch(latestModulithVersion) : latestModulithVersion;
const harnessVersion = harnessChanged ? bumpPatch(harnessBaseVersion) : harnessBaseVersion;

if (!appVersion) {
  throw new Error("Could not resolve an app version: no app@v* tag and no stack version.");
}
if (!docsVersion) {
  throw new Error("Could not resolve a docs version: no docs@v* tag and docs reported unchanged.");
}
if (!webVersion) {
  throw new Error("Could not resolve a web version: no web@v* tag and the web app reported unchanged.");
}
if (!modulithVersion) {
  throw new Error("Could not resolve a modulith version: no modulith@v* tag and the modulith reported unchanged.");
}
if (!harnessVersion) {
  throw new Error("Could not resolve a harness version: no harness@v* tag and the harness reported unchanged.");
}
const plan = {
  stack_version: stackVersion,
  stack_tag: `miot-stack@v${stackVersion}`,
  milestone,
  pull_requests: prs,
  // Provenance of the milestone, not the input to change detection: see changedSince.
  milestone_changed_files: [...changedFiles].sort(),
  components: {
    app: {
      changed: appChanged,
      version: appVersion,
      tag: `app@v${appVersion}`,
    },
    docs: {
      changed: docsChanged,
      changed_since: docsBaseline || null,
      version: docsVersion,
      tag: `docs@v${docsVersion}`,
    },
    web: {
      changed: webChanged,
      changed_since: webBaseline || null,
      version: webVersion,
      tag: `web@v${webVersion}`,
    },
    modulith: {
      changed: modulithChanged,
      changed_since: modulithBaseline || null,
      version: modulithVersion,
      tag: `modulith@v${modulithVersion}`,
    },
    harness: {
      changed: harnessChanged,
      changed_since: harnessBaseline || null,
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
  docs_changed: String(docsChanged),
  docs_changed_since: docsBaseline || "no previous tag",
  docs_version: docsVersion,
  docs_tag: plan.components.docs.tag,
  web_changed: String(webChanged),
  web_changed_since: webBaseline || "no previous tag",
  web_version: webVersion,
  web_tag: plan.components.web.tag,
  modulith_changed: String(modulithChanged),
  modulith_changed_since: modulithBaseline || "no previous tag",
  modulith_version: modulithVersion,
  modulith_tag: plan.components.modulith.tag,
  harness_changed: String(harnessChanged),
  harness_changed_since: harnessBaseline || "no previous tag",
  harness_version: harnessVersion,
  harness_tag: plan.components.harness.tag,
  stack_tag: plan.stack_tag,
  stack_plan_file: planFile,
};

fs.appendFileSync(outputPath, Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
