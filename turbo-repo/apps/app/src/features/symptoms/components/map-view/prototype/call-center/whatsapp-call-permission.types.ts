import { z } from "zod/v3";

const optionalTime = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .default(null);
const optionalText = z.string().nullable().optional().default(null);

const viewSchema = z.object({
  callingEnabled: z.boolean(),
  state: z.enum(["CAN_CALL", "PENDING", "NO_PERMISSION"]),
  permission: z.enum(["NONE", "TEMPORARY", "PERMANENT", "DECLINED", "REVOKED"]),
  expiresAt: optionalTime,
  lastRequestAt: optionalTime,
  canRequest: z.boolean(),
  refusal: optionalText,
  nextRequestAt: optionalTime,
});

const requestSchema = z.object({
  sent: z.boolean(),
  refusal: optionalText,
  detail: optionalText,
  nextRequestAt: optionalTime,
  view: viewSchema,
});

export type CallPermissionView = z.infer<typeof viewSchema>;
export type CallPermissionState = CallPermissionView["state"];
export type CallPermissionRequestResult = z.infer<typeof requestSchema>;

export function parseCallPermissionView(payload: unknown): CallPermissionView {
  return viewSchema.parse(payload);
}

export function parseCallPermissionRequest(
  payload: unknown
): CallPermissionRequestResult {
  return requestSchema.parse(payload);
}
