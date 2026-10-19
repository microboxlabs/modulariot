/** Generate `contract/dashboard-config.schema.json` from the zod schemas. */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ignoreOverride, zodToJsonSchema } from "zod-to-json-schema";
import {
  dashboardConfigSchema,
  widgetSchema,
  dashboardQueryIdentifierSchema,
  dashboardQueryTextSchema,
} from "../src/schema";

/** Where the artifact belongs, relative to this script. */
export const ARTIFACT_URL = new URL(
  "../contract/dashboard-config.schema.json",
  import.meta.url,
);

/** `Widget` is recursive, so it needs a name for `$ref` to point at. */
export function buildJsonSchema(): string {
  const jsonSchema = zodToJsonSchema(dashboardConfigSchema, {
    name: "DashboardConfig",
    override: (definition) => {
      if (definition === dashboardQueryIdentifierSchema._def) {
        return { type: "string", minLength: 1, maxLength: 128 };
      }
      if (definition === dashboardQueryTextSchema._def) {
        return { type: "string", maxLength: 2048 };
      }
      return ignoreOverride;
    },
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
