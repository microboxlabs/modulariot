import { describe, expect, it, vi } from "vitest";
import { skillsCommand } from "../slash/handlers/skills.js";

function mkCtx(client: unknown): Record<string, unknown> {
  let i = 0;
  let n = 0;
  return {
    client,
    session: {
      meta: { tenantId: "mintral", userId: "u", conversationId: "c" },
    },
    now: () => `2026-01-01T00:00:0${n++}Z`,
    uuid: () => `id-${++i}`,
  };
}

const SKILLS = [
  {
    id: "skill-creator",
    name: "skill-creator",
    description: "Create new skills.",
    when_to_use: "Create new skills.",
    scope: "global" as const,
    source: "skill_md" as const,
  },
  {
    id: "delivery-compliance-story",
    name: "Delivery Compliance Story",
    description: "Delivery compliance.",
    when_to_use: "late deliveries",
    scope: "global" as const,
    source: "manifest" as const,
  },
];

describe("/skills", () => {
  it("lists skills as a system item, scoped to the session tenant", async () => {
    const list = vi.fn().mockResolvedValue(SKILLS);
    const r = await skillsCommand.handle([], mkCtx({ skills: { list } }));
    expect(list).toHaveBeenCalledWith({ tenant: "mintral" });
    expect(r.output?.kind).toBe("system");
    if (r.output?.kind === "system") {
      expect(r.output.text).toContain("available skills (2):");
      expect(r.output.text).toContain("skill-creator");
      expect(r.output.text).toContain("Delivery Compliance Story");
    }
  });

  it("handles an empty skill set", async () => {
    const list = vi.fn().mockResolvedValue([]);
    const r = await skillsCommand.handle([], mkCtx({ skills: { list } }));
    if (r.output?.kind === "system") {
      expect(r.output.text).toBe("no skills available");
    }
  });

  it("surfaces a client error as a slash error, not a throw", async () => {
    const list = vi.fn().mockRejectedValue(new Error("harness down"));
    const r = await skillsCommand.handle([], mkCtx({ skills: { list } }));
    expect(r.error).toContain("harness down");
  });

  it("errors cleanly when client is not bound", async () => {
    const r = await skillsCommand.handle([], {
      session: { meta: { tenantId: "x" } },
      now: () => "t",
      uuid: () => "id",
    });
    expect(r.error).toContain("not bound");
  });
});
