/**
 * Generate `contract/dashboard-config.schema.json` from the zod schemas.
 *
 * Reads `src/schema.ts`, not `dist/`, so the committed artifact and the test
 * that compares it come from the same place. Output is deterministic: the same
 * schemas produce a byte-identical file.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { dashboardConfigSchema, widgetSchema } from "../src/schema";

/** Where the artifact belongs, relative to this script. */
export const ARTIFACT_URL = new URL(
  "../contract/dashboard-config.schema.json",
  import.meta.url,
);

/**
 * `Widget` is named as a definition rather than left to inline: it is
 * recursive, so without a name the conversion has nothing to point `$ref` at.
 */
export function buildJsonSchema(): string {
  const jsonSchema = zodToJsonSchema(dashboardConfigSchema, {
    name: "DashboardConfig",
    definitions: { Widget: widgetSchema },
  });
  return `${JSON.stringify(jsonSchema, null, 2)}\n`;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  writeFileSync(ARTIFACT_URL, buildJsonSchema());
  console.log("wrote contract/dashboard-config.schema.json");
}
