import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET } from "./route";

describe("release notes catalog", () => {
  const originalCwd = process.cwd();
  const originalAudience = process.env.RELEASE_NOTES_AUDIENCE;
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "miot-notes-"));
    const releases = path.join(directory, "src", "releases");
    fs.mkdirSync(path.join(releases, "platform"), { recursive: true });
    fs.writeFileSync(path.join(releases, "v1.32.0.mdx"), "Coordinator");
    fs.writeFileSync(path.join(releases, "platform", "v0.6.0.mdx"), "Platform");
    fs.writeFileSync(
      path.join(releases, "platform", "README.md"),
      "Documentation"
    );
    process.chdir(directory);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(directory, { recursive: true, force: true });
    if (originalAudience === undefined)
      delete process.env.RELEASE_NOTES_AUDIENCE;
    else process.env.RELEASE_NOTES_AUDIENCE = originalAudience;
  });

  it("lists platform releases without Coordinator files or documentation", async () => {
    process.env.RELEASE_NOTES_AUDIENCE = "platform";
    expect(await (await GET()).json()).toEqual({ files: ["v0.6.0.mdx"] });
  });

  it("preserves the default Coordinator catalog", async () => {
    delete process.env.RELEASE_NOTES_AUDIENCE;
    expect(await (await GET()).json()).toEqual({ files: ["v1.32.0.mdx"] });
  });

  it("returns an empty platform catalog rather than Coordinator notes before its first release", async () => {
    process.env.RELEASE_NOTES_AUDIENCE = "platform";
    fs.rmSync(path.join(directory, "src", "releases", "platform"), {
      recursive: true,
    });
    expect(await (await GET()).json()).toEqual({ files: [] });
  });
});
