const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { components, compatibleBuild, selectBuild, waitForBuild } = require("../scripts/resolve-trunk-builds.js");

const cwd = mkdtempSync(path.join(tmpdir(), "trunk-builds-"));
after(() => rmSync(cwd, { recursive: true, force: true }));
const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
git("init", "-q");
git("config", "user.name", "Test");
git("config", "user.email", "test@example.com");
function commit(file, content) {
  mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  writeFileSync(path.join(cwd, file), content);
  git("add", ".");
  git("commit", "-qm", file);
  return git("rev-parse", "HEAD");
}
const original = commit("backend/main", "original");
const selected = commit("frontend/main", "selected");
const later = commit("backend/main", "later");
const build = (head_sha, extra = {}) => ({ id: 1, head_sha, head_branch: "trunk", event: "push", status: "completed", conclusion: "success", html_url: "https://example.com/build/1", ...extra });

test("reuses an ancestor build when component inputs match the selected trunk tree", () => {
  assert.equal(compatibleBuild(build(original), selected, ["backend"], cwd), true);
  assert.equal(compatibleBuild(build(original), later, ["backend"], cwd), false);
});

test("excludes newer trunk, PR, other branch and malformed build sources", () => {
  for (const candidate of [build(later), build(original, { event: "pull_request" }), build(original, { head_branch: "main" }), build("invalid")]) {
    assert.equal(compatibleBuild(candidate, selected, ["backend"], cwd), false);
  }
});

test("does not hide a newer pending or failed compatible build behind an older success", () => {
  const pending = build(original, { id: 2, status: "in_progress", conclusion: null });
  assert.equal(selectBuild([build(original), pending], selected, ["backend"], cwd), pending);
  const failed = build(original, { id: 3, conclusion: "failure" });
  assert.equal(selectBuild([failed, pending], selected, ["backend"], cwd), failed);
});

test("rejects a build that does not contain a shared dependency change", () => {
  assert.equal(compatibleBuild(build(original), selected, ["backend", "frontend"], cwd), false);
});

test("waits for the same compatible build to succeed", async () => {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  let calls = 0;
  const result = await waitForBuild("test", { workflow: "ci.yaml", paths: ["README.md"] }, sha, {
    repository: "test/repo", pollMs: 0,
    listBuilds: () => [build(sha, ++calls === 1 ? { status: "queued", conclusion: null } : {})],
  });
  assert.equal(result.head_sha, sha);
  assert.equal(calls, 2);
});

test("fails closed on failed CI and missing builds", async () => {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const component = { workflow: "ci.yaml", paths: ["README.md"] };
  await assert.rejects(waitForBuild("test", component, sha, { repository: "test/repo", listBuilds: () => [build(sha, { conclusion: "failure" })] }), /concluded failure/);
  let clock = 0;
  await assert.rejects(waitForBuild("test", component, sha, { repository: "test/repo", timeoutMs: 2, now: () => clock++, sleep: async () => {}, listBuilds: () => [] }), /no successful compatible build/);
});

test("the CLI rejects manual deployments from branches other than trunk", () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, "../scripts/resolve-trunk-builds.js")], { env: { ...process.env, GITHUB_REF: "refs/heads/feature" }, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refs\/heads\/trunk/);
});

test("the CLI outputs validated source SHAs for every component without dispatching a deployment", () => {
  const bin = path.join(cwd, "bin");
  mkdirSync(bin);
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  writeFileSync(path.join(bin, "gh"), `#!${process.execPath}\nif (process.argv[2] !== "api" || !process.argv[3].includes("/runs?branch=trunk")) process.exit(2);\nconsole.log(${JSON.stringify(JSON.stringify([build(sha)]))});\n`, { mode: 0o755 });
  const output = path.join(cwd, "outputs");
  const result = spawnSync(process.execPath, [path.join(__dirname, "../scripts/resolve-trunk-builds.js")], {
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, GITHUB_REF: "refs/heads/trunk", SOURCE_SHA: sha, GITHUB_SHA: "b".repeat(40), GITHUB_REPOSITORY: "test/repo", GITHUB_OUTPUT: output },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  for (const name of Object.keys(components)) {
    assert.ok(readFileSync(output, "utf8").includes(`${name}_source_sha=${sha}\n${name}_short_sha=${sha.slice(0, 7)}\n`));
  }
});

test("component inputs stay aligned with each build workflow's push paths", () => {
  for (const component of Object.values(components)) {
    const workflow = readFileSync(path.join(__dirname, "../workflows", component.workflow), "utf8");
    const push = workflow.match(/^  push:\n([\s\S]*?)(?=^  \w|^\S)/m)[1];
    const paths = push.match(/    paths:\n((?:      -[^\n]*\n|      #[^\n]*\n)+)/)[1];
    const inputs = [...paths.matchAll(/^      - ['"]([^'"]+)['"]/gm)].map((match) => match[1].replace(/\/\*\*$/, ""));
    assert.deepEqual(component.paths, inputs, component.workflow);
  }
});
