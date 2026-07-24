#!/usr/bin/env node
/**
 * Generate JSON Schema artifacts from the zod config contract (built dist).
 *
 * Runs as part of `npm run build`. The artifact is what non-TS consumers —
 * notably the AI dashboard-generation skill — validate configs against.
 * Output must be deterministic: same input schemas → byte-identical file.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { dashboardConfigSchema, widgetSchema } from "../dist/schema.js";

const jsonSchema = zodToJsonSchema(dashboardConfigSchema, {
  name: "DashboardConfig",
  definitions: { Widget: widgetSchema },
});

const outDir = new URL("../schema/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const outFile = new URL("dashboard-config.schema.json", outDir);
writeFileSync(outFile, `${JSON.stringify(jsonSchema, null, 2)}\n`);
console.log("schema artifact: schema/dashboard-config.schema.json");
