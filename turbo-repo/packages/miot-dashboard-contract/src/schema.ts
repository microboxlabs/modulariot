/**
 * Validation for the persisted dashboard document.
 *
 * These schemas are the source of truth.
 * `contract/dashboard-config.schema.json` is generated from them for consumers
 * that are not TypeScript.
 *
 * Unknown keys pass through at every level, so a document written by a newer
 * version survives a load-validate-save round trip without losing fields.
 *
 * There is no migration function here. Each implementation decides what to do
 * with a version it does not understand; none of them may guess.
 */

import { z } from "zod";
import type { DashboardStorageSchema, Widget } from "./document";

/** The version this package describes. */
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

/** Recursive: containers hold widgets, which may be containers. */
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
    .passthrough(),
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
      z.object({ key: z.string(), value: z.string() }).passthrough(),
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
      .array(z.object({ label: z.string(), value: z.string() }).passthrough())
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

/** The persisted document, version 2. */
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

/**
 * A validation result in plain types rather than zod's, so a consumer is not
 * tied to our major version of zod. `problems` are text, ready for a 400 body.
 */
export type ConfigValidation =
  | { readonly valid: true; readonly config: DashboardStorageSchema }
  | { readonly valid: false; readonly problems: readonly string[] };

/**
 * Check an unknown value against the document contract.
 *
 * Each problem reads `path: message`, dotted from the document root
 * (`widgets.0.layout.x`). A problem with the document itself has no path.
 */
export function validateDashboardConfig(input: unknown): ConfigValidation {
  const result = dashboardConfigSchema.safeParse(input);
  if (result.success) {
    return { valid: true, config: result.data as DashboardStorageSchema };
  }
  const problems = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path === "" ? issue.message : `${path}: ${issue.message}`;
  });
  return { valid: false, problems };
}
