import { describe, expect, it } from "vitest";

import { mcpStepKeyOf, stepKeyOf, stepLabel } from "./step-labels";

describe("step labels", () => {
  it("matches connection tools on their primitive suffix", () => {
    expect(stepKeyOf("fleet_profile")).toBe("profile");
    expect(stepKeyOf("gps_list_tables")).toBe("list_tables");
    expect(stepKeyOf("web_search")).toBe("web_search");
    expect(stepKeyOf("acs_workflow")).toBe("workflow");
  });

  it("labels the artifact, source and web tools", () => {
    for (const tool of [
      "artifact",
      "source_search",
      "source_read",
      "source_list",
      "web_fetch",
    ]) {
      expect(stepKeyOf(tool)).toBe(tool);
    }
  });

  it("keeps the raw name for a tool it does not know", () => {
    expect(stepLabel("fs_read", ((k: string) => k) as never)).toBe("fs_read");
  });

  it("labels an mcp_call by the MCP tool it calls", () => {
    const tr = ((k: string, p?: Record<string, string>) =>
      p ? `[${k}:${p.tool}]` : `[${k}]`) as never;
    const call = (tool: string) =>
      stepLabel("mcp_call", tr, { skill_id: "storyteller", tool });
    expect(call("stories_create")).toBe(
      "[harnessChat.stream.mcpSteps.stories_create]"
    );
    expect(call("selectables_options")).toBe(
      "[harnessChat.stream.mcpSteps.selectables]"
    );
    expect(call("connections_templates")).toBe(
      "[harnessChat.stream.mcpSteps.connections]"
    );
    expect(call("tickets_open")).toBe(
      "[harnessChat.stream.mcpSteps.other:tickets_open]"
    );
    expect(stepLabel("mcp_call", tr)).toBe("[harnessChat.stream.steps.call]");
  });

  it("prefers an MCP tool's own label over its family", () => {
    expect(mcpStepKeyOf("connections_test")).toBe("connections_test");
    expect(mcpStepKeyOf("connections_get")).toBe("connections");
    expect(mcpStepKeyOf("stories_set_current")).toBeNull();
  });

  it("reads the label from the dictionary", () => {
    expect(stepLabel("acs_show", ((k: string) => `[${k}]`) as never)).toBe(
      "[harnessChat.stream.steps.show]"
    );
  });
});
