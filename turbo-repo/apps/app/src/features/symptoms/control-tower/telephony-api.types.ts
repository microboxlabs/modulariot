import { z } from "zod/v3";

const providerSchema = z.enum(["TELNYX", "TEAMS_PHONE"]);
const lineSchema = z.object({
  connectionId: z.string().min(1),
  provider: providerSchema,
  name: z.string(),
  callerNumber: z.string().nullable().optional().default(null),
  ready: z.boolean(),
  /** The platform shared line; absent on older responses. */
  managed: z.boolean().optional(),
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

const webRtcTokenSchema = z.object({
  token: z.string().trim().min(1),
  callerNumber: z.string().regex(/^\+[1-9]\d{6,14}$/),
  expiresAt: z.string().datetime({ offset: true }),
  callRef: z.string().min(1).nullable().optional(),
});
export type WebRtcToken = z.infer<typeof webRtcTokenSchema>;

export function parseWebRtcToken(payload: unknown): WebRtcToken {
  return webRtcTokenSchema.parse(payload);
}

/** The organization's tested TEAMS_PHONE connection, if any. Calls on it are reconciled from Graph. */
export function readyTeamsLine(
  setup: TelephonySetup | null | undefined
): TelephonyLine | null {
  return (
    setup?.lines.find((l) => l.provider === "TEAMS_PHONE" && l.ready) ?? null
  );
}
