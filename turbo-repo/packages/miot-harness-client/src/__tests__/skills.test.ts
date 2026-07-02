import { describe, expect, it } from "vitest";
import { createMiotHarnessClient } from "../client.js";
import type { SkillSummary } from "../types.js";
import { createMockFetch } from "./test-utils.js";

const SKILLS: SkillSummary[] = [
  {
    id: "skill-creator",
    name: "skill-creator",
    description: "Create new skills.",
    when_to_use: "Create new skills.",
    scope: "global",
    source: "skill_md",
  },
];

describe("skills.list", () => {
  it("GETs /skills and returns the summaries", async () => {
    const { fn, call } = createMockFetch(SKILLS);
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });
    const result = await client.skills.list();
    expect(result).toEqual(SKILLS);
    expect(call.url).toBe("http://harness.local/skills");
    expect(call.init.method).toBe("GET");
  });

  it("passes the tenant as a query param", async () => {
    const { fn, call } = createMockFetch(SKILLS);
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });
    await client.skills.list({ tenant: "mintral" });
    expect(call.url).toBe("http://harness.local/skills?tenant=mintral");
  });
});
