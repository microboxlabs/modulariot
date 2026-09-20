import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ARTIFACT_URL, buildJsonSchema } from "../scripts/generate-json-schema";
import { DEFAULT_STORAGE, type Widget } from "./document";
import {
  CURRENT_DASHBOARD_CONFIG_VERSION,
  dashboardConfigSchema,
  validateDashboardConfig,
} from "./schema";

function widget(id: string, children?: Widget[]): Widget {
  return {
    id,
    componentId: "card",
    layout: { i: id, x: 0, y: 0, w: 4, h: 3 },
    config: {},
    ...(children === undefined ? {} : { children }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("validateDashboardConfig", () => {
  it("accepts the default document", () => {
    const result = validateDashboardConfig(DEFAULT_STORAGE);
    expect(result.valid).toBe(true);
  });

  it("validates a widget tree to its full depth", () => {
    const deep = {
      ...DEFAULT_STORAGE,
      widgets: [widget("a", [widget("b", [widget("c")])])],
    };
    expect(validateDashboardConfig(deep).valid).toBe(true);
  });

  it("reports the path of a fault nested inside the tree", () => {
    const broken = {
      ...DEFAULT_STORAGE,
      // Cast because the point is a document TypeScript would have rejected:
      // it arrived as JSON over the wire, where nothing checked it.
      widgets: [
        widget("a", [
          { ...widget("b"), layout: { i: "b", x: "0" } } as unknown as Widget,
        ]),
      ],
    };
    const result = validateDashboardConfig(broken);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.problems.join(" | ")).toContain(
      "widgets.0.children.0.layout",
    );
  });

  it("describes a document that is not an object without a path", () => {
    const result = validateDashboardConfig("not a dashboard");
    expect(result.valid).toBe(false);
    if (result.valid) return;
    // An empty path would otherwise render as a leading ": ".
    expect(result.problems.every((problem) => !problem.startsWith(":"))).toBe(
      true,
    );
  });

  /**
   * The forward-compatibility promise: a document written by a newer minor
   * version survives a load-validate-save round trip in an older reader with
   * the fields that reader has never heard of still on it. Strip them and
   * every additive change silently deletes data.
   */
  it("keeps keys it does not know about, at every level", () => {
    const future = {
      ...DEFAULT_STORAGE,
      widgets: [{ ...widget("a"), pinned: true }],
      preferences: { editMode: false, theme: "dark" },
      annotations: [{ note: "from a later version" }],
    };
    const result = validateDashboardConfig(future);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const config = result.config as unknown as Record<string, unknown>;
    expect(config.annotations).toEqual([{ note: "from a later version" }]);
    expect((config.preferences as Record<string, unknown>).theme).toBe("dark");
    expect((config.widgets as Record<string, unknown>[])[0]?.pinned).toBe(true);
  });

  /**
   * The shared refusal. Both halves reject a version they do not understand
   * rather than guessing: coercing a v3 document into v2 would drop whatever
   * v3 added, and the next save would write the loss back.
   */
  it.each([1, 3, "2", null])("refuses version %o", (version) => {
    const result = validateDashboardConfig({ ...DEFAULT_STORAGE, version });
    expect(result.valid).toBe(false);
  });

  it("refuses a refresh interval that is not one of the offered values", () => {
    const result = validateDashboardConfig({
      ...DEFAULT_STORAGE,
      refreshInterval: 45,
    });
    expect(result.valid).toBe(false);
  });
});

describe("the generated JSON Schema artifact", () => {
  /**
   * The artifact is committed so that a consumer reading the repository has
   * it, which means it can go stale the moment someone edits a zod schema.
   * This is the only thing that notices.
   */
  it("matches what the current schemas generate", () => {
    const committed = readFileSync(ARTIFACT_URL, "utf8");
    expect(committed).toBe(buildJsonSchema());
  });

  /**
   * Two descriptions of one contract can disagree, and the way they disagree
   * that matters is about what a document must carry: a field required in one
   * and optional in the other means two implementations accept different
   * documents while both claim to follow this package.
   */
  it("requires exactly the fields zod requires", () => {
    const artifact = JSON.parse(buildJsonSchema()) as {
      definitions: Record<string, { required?: string[] }>;
    };
    const fromJsonSchema = [
      ...(artifact.definitions.DashboardConfig?.required ?? []),
    ].sort();
    const fromZod = Object.entries(dashboardConfigSchema.shape)
      .filter(([, field]) => !field.isOptional())
      .map(([name]) => name)
      .sort();
    expect(fromJsonSchema).toEqual(fromZod);
  });

  it("names the version this package describes", () => {
    const artifact = JSON.parse(buildJsonSchema()) as {
      definitions: Record<
        string,
        { properties?: Record<string, { const?: unknown }> }
      >;
    };
    expect(
      artifact.definitions.DashboardConfig?.properties?.version?.const,
    ).toBe(CURRENT_DASHBOARD_CONFIG_VERSION);
  });
});
