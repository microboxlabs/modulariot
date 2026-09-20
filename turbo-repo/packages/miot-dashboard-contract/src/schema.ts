/**
 * Validation for the persisted dashboard document.
 *
 * The zod schemas here are the source of truth; the JSON Schema artifact in
 * `contract/dashboard-config.schema.json` is generated from them at build time,
 * for consumers that are not TypeScript — another language implementing the
 * server, or the dashboard-generation skill checking its own output.
 *
 * **Unknown keys pass through, deliberately.** A document written by a newer
 * minor version has to survive a load-validate-save round trip in an older
 * reader without losing the fields that reader has never heard of. Rejecting
 * them would turn every additive change into a breaking one.
 *
 * **Migration is not here, also deliberately.** The two halves disagree about
 * what to do with a document of the wrong version, and they are both right:
 * a renderer may coerce a legacy blob into something displayable, while the
 * server refuses it by name so an operator can see what is out there (the
 * decision behind `importDashboards`). A shared function only one side may
 * call is a contract that lies. What *is* shared is the refusal: every
 * implementation rejects a version it does not understand rather than
 * guessing, because a silent downgrade destroys data on the next save.
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
 * The outcome of a validation, in plain types.
 *
 * Deliberately not zod's own result. A host implementing the other half of
 * this contract should not be forced onto our major version of zod to read an
 * answer, and the problems are wanted as text anyway — they go into the 400
 * an API returns.
 */
export type ConfigValidation =
  | { readonly valid: true; readonly config: DashboardStorageSchema }
  | { readonly valid: false; readonly problems: readonly string[] };

/**
 * Check an unknown value against the document contract.
 *
 * Each problem reads `path: message`, with the path dotted from the document
 * root (`widgets.0.layout.x`). An empty path means the document itself, so
 * those problems read as a bare message.
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
