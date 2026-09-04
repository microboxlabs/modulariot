import type { JSONSchema7 } from "json-schema";
import { getAllDashlets } from "@/features/dashboard/dashlets";
import type { HarnessExtension } from "../harness-extension";
import { ShowDashletCard } from "./components/show-dashlet-card";

export type ShowDashletArgs = {
  /** Dashlet registry id, e.g. "stat_icon", "chart", "data_table". */
  dashletId: string;
  /** Dashlet-specific config — same shape as that dashlet's own DashletConfig. */
  config?: Record<string, unknown>;
};

export type ShowDashletResult = Record<string, never>;

/**
 * Infers a JSON Schema shape from a sample value — there's no runtime type
 * info for a dashlet's `DashletConfig` TS interface (types erase at compile
 * time), but every dashlet already ships a concrete `defaultConfig` object,
 * so its own values stand in as the schema source. Not a substitute for a
 * hand-authored schema (misses fields absent from the default, can't express
 * enums/unions), but it's real, structural, and costs zero authoring work
 * per dashlet.
 */
function inferJsonSchema(value: unknown): JSONSchema7 {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length > 0 ? inferJsonSchema(value[0]) : {},
    };
  }
  switch (typeof value) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "object": {
      const properties: Record<string, JSONSchema7> = {};
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        properties[key] = inferJsonSchema(v);
      }
      return { type: "object", properties };
    }
    default:
      return {};
  }
}

/**
 * Builds the per-dashlet reference the harness needs to know what `config`
 * fields exist — computed once at module load from the same registry
 * (`getAllDashlets()`) that `ShowDashletCard` reads at render time and that
 * adding a new dashlet already populates. There's no second place to keep
 * this in sync: register a dashlet once, its schema shows up here too.
 *
 * `config`'s shape depends on `dashletId`, so a flat schema can't describe
 * it — this is a discriminated union: one `oneOf` branch per dashlet,
 * `dashletId` pinned via `const` alongside that dashlet's inferred `config`
 * shape. Excludes showInChat: false dashlets — no point describing a shape
 * the harness can't actually get rendered.
 */
function buildDashletConfigVariants(): JSONSchema7[] {
  return getAllDashlets()
    .filter((d) => d.showInChat !== false)
    .map((d) => ({
      properties: {
        dashletId: { const: d.meta.id },
        config: inferJsonSchema(d.defaultConfig),
      },
    }));
}

export const showDashletExtension: HarnessExtension<ShowDashletArgs, ShowDashletResult> = {
  toolName: "show_dashlet",
  description:
    "Show a dashboard widget (dashlet) inline in the chat — e.g. a stat card, chart, or table — given its dashlet registry id and config. " +
    "`config`'s valid fields depend on `dashletId` — see `parameters.oneOf` for the exact shape per dashlet. " +
    "Omit a config field to fall back to that dashlet's own default.",
  parameters: {
    type: "object",
    properties: {
      dashletId: { type: "string", enum: getAllDashlets().filter((d) => d.showInChat !== false).map((d) => d.meta.id) },
      config: { type: "object" },
    },
    required: ["dashletId"],
    oneOf: buildDashletConfigVariants(),
  },
  render: ShowDashletCard,
};
