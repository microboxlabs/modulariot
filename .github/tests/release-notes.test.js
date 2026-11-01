const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { preparePrompts } = require("../scripts/prepare-release-notes");

test("platform prompts contain only the matching OSS milestone and use the stack version", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "release-notes-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const template = fs.readFileSync(path.join(__dirname, "../prompts/app-release-notes.prompt.yml"), "utf8");
  const issues = [
    { source: "release", milestone: "Release 1.32.0", title: "Private client change" },
    { source: "oss", milestone: "MIOT-0.6.0", title: "Platform feature {{private_milestone}}" },
    { source: "oss", milestone: "MIOT-0.5.65", title: "Older platform feature" },
    { source: "release", milestone: "MIOT-0.6.0", title: "Wrong source" },
  ];
  preparePrompts(template, issues, {
    release_version: "0.6.0", release_notes_version: "1.32.0",
    private_milestone: "Release 1.32.0", oss_milestone: "MIOT-0.6.0",
  }, directory);
  const platform = fs.readFileSync(`${directory}/release-notes-platform.prompt.yml`, "utf8");
  const coordinator = fs.readFileSync(`${directory}/release-notes-coordinator.prompt.yml`, "utf8");
  assert.match(platform, /Release Notes v0\.6\.0/);
  assert.match(platform, /Platform feature \{\{private_milestone\}\}/);
  assert.doesNotMatch(platform, /Private client change|1\.32\.0|Older platform feature|Wrong source/);
  assert.match(coordinator, /Release Notes v1\.32\.0/);
  assert.match(coordinator, /Private client change/);
  assert.match(coordinator, /Platform feature/);
  assert.doesNotMatch(coordinator, /Older platform feature|Wrong source/);
});
