/**
 * @microboxlabs/miot-dashboard-ui/schema — the dashboard config data contract.
 *
 * Zod schemas for the persisted dashboard config (`DashboardStorageSchema`),
 * plus versioning and migration. This entry is React-free (servers import it
 * to validate configs; the AI dashboard-generation skill validates against
 * the JSON Schema artifact generated from it at build time — see
 * scripts/generate-json-schema.mjs → schema/dashboard-config.schema.json).
 *
 * Schemas are deliberately lenient about unknown keys (`passthrough`):
 * persisted configs written by newer minor versions must survive a
 * load-validate-save round trip without data loss.
 */

import { z } from "zod";
import {
  DEFAULT_STORAGE,
  type DashboardStorageSchema,
  type Widget,
} from "./types/dashboard";

export const CURRENT_DASHBOARD_CONFIG_VERSION = 2 as const;

export const gridLayoutItemSchema = z
  .object({
    i: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    minW: z.number().optional(),
    minH: z.number().optional(),
    maxW: z.number().optional(),
    maxH: z.number().optional(),
  })
  .passthrough();

/** Recursive widget tree schema. */
export const widgetSchema: z.ZodType<Widget> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      componentId: z.string(),
      layout: gridLayoutItemSchema,
      config: z.record(z.unknown()),
      children: z.array(widgetSchema).optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
    .passthrough()
) as z.ZodType<Widget>;

export const dashboardPreferencesSchema = z
  .object({ editMode: z.boolean() })
  .passthrough();

export const plannerRequestDefinitionSchema = z
  .object({
    id: z.string(),
    variableName: z.string(),
    pgrestFunctionName: z.string(),
    pgrestHttpMethod: z.enum(["POST", "GET"]),
    pgrestParams: z.array(
      z.object({ key: z.string(), value: z.string() }).passthrough()
    ),
    dataSourceId: z.string().optional(),
    schema: z.array(z.string()).optional(),
  })
  .passthrough();

export const dashboardFilterParamSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    type: z.enum(["text", "date_range", "select"]),
    unique: z.boolean().optional(),
    options: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .optional(),
  })
  .passthrough();

export const refreshIntervalSchema = z.union([
  z.literal(0),
  z.literal(10),
  z.literal(30),
  z.literal(60),
  z.literal(300),
]);

/** The persisted dashboard config contract (version 2). */
export const dashboardConfigSchema = z
  .object({
    version: z.literal(CURRENT_DASHBOARD_CONFIG_VERSION),
    name: z.string(),
    widgets: z.array(widgetSchema),
    preferences: dashboardPreferencesSchema,
    requestPlanner: z.array(plannerRequestDefinitionSchema).optional(),
    filters: z.array(dashboardFilterParamSchema).optional(),
    refreshInterval: refreshIntervalSchema.optional(),
    order: z.number().optional(),
    allowedGroups: z.array(z.string()).optional(),
  })
  .passthrough();

export type ValidatedDashboardConfig = z.infer<typeof dashboardConfigSchema>;

/** Validate an unknown value against the current config contract. */
export function validateDashboardConfig(input: unknown) {
  return dashboardConfigSchema.safeParse(input);
}

export class DashboardConfigMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardConfigMigrationError";
  }
}

/**
 * Migrate an unknown persisted value to the current config version.
 *
 * - `null`/`undefined` → a fresh default config.
 * - `version: 2` → validated as-is (throws when structurally invalid).
 * - unversioned / `version: 1` legacy blobs → best-effort coercion of the
 *   recognizable fields onto version 2 defaults.
 * - versions newer than this library understands → error (never guess
 *   forward: a silent downgrade would destroy data on the next save).
 */
export function migrateDashboardConfig(input: unknown): DashboardStorageSchema {
  if (input === null || input === undefined) {
    return structuredClone(DEFAULT_STORAGE);
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new DashboardConfigMigrationError(
      `dashboard config must be an object, got ${Array.isArray(input) ? "array" : typeof input}`
    );
  }
  const record = input as Record<string, unknown>;
  const version = record.version;

  if (version === CURRENT_DASHBOARD_CONFIG_VERSION) {
    const result = dashboardConfigSchema.safeParse(record);
    if (!result.success) {
      throw new DashboardConfigMigrationError(
        `dashboard config v2 failed validation: ${result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`
      );
    }
    return result.data as DashboardStorageSchema;
  }

  if (typeof version === "number" && version > CURRENT_DASHBOARD_CONFIG_VERSION) {
    throw new DashboardConfigMigrationError(
      `dashboard config version ${version} is newer than this library supports (${CURRENT_DASHBOARD_CONFIG_VERSION}) — refusing to downgrade`
    );
  }

  // Legacy (v1 / unversioned): keep what we recognize, default the rest.
  const migrated: DashboardStorageSchema = {
    ...structuredClone(DEFAULT_STORAGE),
    ...(typeof record.name === "string" ? { name: record.name } : {}),
  };
  const widgets = z.array(widgetSchema).safeParse(record.widgets);
  if (widgets.success) migrated.widgets = widgets.data;
  const preferences = dashboardPreferencesSchema.safeParse(record.preferences);
  if (preferences.success) {
    migrated.preferences = preferences.data as DashboardStorageSchema["preferences"];
  }
  return migrated;
}
