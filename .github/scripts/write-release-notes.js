const fs = require("node:fs");

const notes = [
  ["coordinator", process.env.NOTES_VERSION, "releases/notes", "turbo-repo/apps/app/src/releases"],
  ["platform", process.env.STACK_VERSION, "releases/platform", "turbo-repo/apps/app/src/releases/platform"],
];

for (const [audience, version, archive, app] of notes) {
  if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
    throw new Error(`Invalid ${audience} notes version`);
  }
  const source = `release-notes-${audience}.response.mdx`;
  const content = fs.readFileSync(source, "utf8").trim()
    .replace(/^```(?:mdx|markdown|md)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!content.startsWith(`# 🔔 Release Notes v${version} —`)) {
    throw new Error(`AI response did not start with the expected ${audience} versioned heading`);
  }
  for (const directory of [archive, app]) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(`${directory}/v${version}.mdx`, `${content}\n`);
  }
}
