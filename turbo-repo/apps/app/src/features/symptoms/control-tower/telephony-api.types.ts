import { z } from "zod/v3";

const providerSchema = z.enum(["TELNYX", "TEAMS_PHONE"]);
const lineSchema = z.object({
  connectionId: z.string().min(1),
  provider: providerSchema,
  name: z.string(),
  callerNumber: z.string().nullable().optional().default(null),
  ready: z.boolean(),
});
const setupSchema = z.object({
  preferred: providerSchema.nullable().optional().default(null),
  active: lineSchema.nullable().optional().default(null),
  lines: z.array(lineSchema),
});

const reconcileResultSchema = z.object({
  checked: z.number().int().nonnegative(),
  recorded: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
});
export type ReconcileResult = z.infer<typeof reconcileResultSchema>;

export function parseReconcileResult(payload: unknown): ReconcileResult {
  return reconcileResultSchema.parse(payload);
}

export type TelephonyProvider = z.infer<typeof providerSchema>;
export type TelephonyLine = z.infer<typeof lineSchema>;
export type TelephonySetup = z.infer<typeof setupSchema>;

export function parseTelephonySetup(payload: unknown): TelephonySetup {
  return setupSchema.parse(payload);
}
