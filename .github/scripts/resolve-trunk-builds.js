#!/usr/bin/env node
const { execFileSync, spawnSync } = require("node:child_process");
const { appendFileSync } = require("node:fs");
const { setTimeout: delay } = require("node:timers/promises");

// Keep these inputs in sync with each workflow's push.paths. A compatible build
// can precede the selected commit when that component's inputs have not changed.
const components = {
  app: { workflow: "ci.yaml", paths: ["turbo-repo", ".github/workflows/ci.yaml"] },
  docs: {
    workflow: "docs.yml",
    paths: ["turbo-repo/apps/docs", "turbo-repo/packages/ui", "turbo-repo/packages/typescript-config", "turbo-repo/packages/eslint-config", "turbo-repo/package-lock.json", "turbo-repo/docker/nextjs.standalone-docs.Dockerfile", ".github/workflows/docs.yml"],
  },
  web: {
    workflow: "web.yml",
    paths: ["turbo-repo/apps/web", "turbo-repo/packages/typescript-config", "turbo-repo/packages/eslint-config", "turbo-repo/package-lock.json", "turbo-repo/docker/nextjs.standalone.Dockerfile", ".github/workflows/web.yml"],
  },
  modulith: { workflow: "quarkus.yml", paths: ["quarkus-srv", ".github/workflows/quarkus.yml"] },
  harness: { workflow: "harness.yaml", paths: ["miot-harness", ".github/workflows/harness.yaml", "turbo-repo/apps/app/src/features/layout/models/pages-config.json"] },
};

const run = (command, args) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

function compatibleBuild(build, sha, paths, cwd = process.cwd()) {
  if (!/^[a-f0-9]{40}$/.test(build.head_sha) || build.head_branch !== "trunk" ||
      !["push", "workflow_dispatch"].includes(build.event)) return false;
  const git = (args) => spawnSync("git", args, { cwd, stdio: "ignore" }).status === 0;
  return git(["merge-base", "--is-ancestor", build.head_sha, sha]) &&
    git(["diff", "--quiet", build.head_sha, sha, "--", ...paths]);
}

function selectBuild(builds, sha, paths, cwd) {
  // Prefer the newest matching run, including pending/failed runs. An older
  // successful run must not conceal a failed or unfinished validation rerun.
  return [...builds].sort((a, b) => b.id - a.id)
    .find((build) => compatibleBuild(build, sha, paths, cwd));
}

async function waitForBuild(name, component, sha, { repository, timeoutMs = 30 * 60_000, pollMs = 15_000, listBuilds, sleep = delay, now = Date.now }) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const build = selectBuild(await listBuilds(component.workflow), sha, component.paths);
    if (build?.status === "completed") {
      if (build.conclusion !== "success") {
        throw new Error(`${name}: matching build ${build.html_url} concluded ${build.conclusion}; refusing to deploy.`);
      }
      console.log(`${name}: ${build.head_sha} (${build.html_url})`);
      return build;
    }
    console.log(`Waiting for ${name} validation compatible with ${sha} in ${repository}...`);
    await sleep(pollMs);
  }
  throw new Error(`${name}: no successful compatible build within ${timeoutMs / 60_000} minutes. Run ${component.workflow} on trunk and retry.`);
}

async function main() {
  const { GITHUB_REPOSITORY: repository, GITHUB_SHA: sha, GITHUB_REF: ref, GITHUB_OUTPUT: output } = process.env;
  if (ref !== "refs/heads/trunk" || !/^[a-f0-9]{40}$/.test(sha ?? "") || !repository || !output) {
    throw new Error("Deploy trunk requires refs/heads/trunk, GITHUB_SHA, GITHUB_REPOSITORY and GITHUB_OUTPUT.");
  }
  const listBuilds = (workflow) => JSON.parse(run("gh", ["api",
    `repos/${repository}/actions/workflows/${workflow}/runs?branch=trunk&per_page=100`,
    "--jq", ".workflow_runs | map({id, head_sha, head_branch, event, status, conclusion, html_url})",
  ]));
  const builds = await Promise.all(Object.entries(components).map(async ([name, component]) => {
    const build = await waitForBuild(name, component, sha, { repository, listBuilds });
    return `${name}_source_sha=${build.head_sha}\n${name}_short_sha=${build.head_sha.slice(0, 7)}\n`;
  }));
  appendFileSync(output, builds.join(""));
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });
module.exports = { components, compatibleBuild, selectBuild, waitForBuild };
