import { z } from "zod";
import { RESEND_PROVIDER as RESEND_CREDENTIAL } from "@/features/credentials/credential.types";
import type {
  ChannelCreate,
  ChannelUpdate,
  IntegrationConnection,
} from "../channels/channel.types";

export const RESEND_PROVIDER = "RESEND";
export const RESEND_BASE_URL = "https://api.resend.com";

/** `Name <address@domain>` or a bare address. */
export function isSender(value: string): boolean {
  const trimmed = value.trim();
  const open = trimmed.lastIndexOf("<");
  const address =
    open >= 0 && trimmed.endsWith(">") ? trimmed.slice(open + 1, -1) : trimmed;
  const at = address.indexOf("@");
  return (
    at > 0 &&
    at === address.lastIndexOf("@") &&
    address.lastIndexOf(".") > at + 1 &&
    !address.includes(" ")
  );
}

/** The credential select's value for "enter a new API key". */
export const NEW_KEY = "";

const emailBaseShape = {
  name: z.string().min(1, "validation.nameRequired"),
  from: z.string().refine(isSender, "validation.fromInvalid"),
  baseUrl: z.string().url("validation.baseUrlInvalid"),
  credentialId: z.string(),
};

/** Create form: a stored Resend credential, or a new key. Messages are dictionary keys. */
export const EmailConnectionSchema = z
  .object({ ...emailBaseShape, token: z.string() })
  .refine((form) => form.credentialId !== NEW_KEY || form.token.trim() !== "", {
    path: ["token"],
    message: "validation.tokenRequired",
  });

export type EmailFormData = z.infer<typeof EmailConnectionSchema>;

/** Edit form: a blank API key keeps the stored one. */
export const EmailEditSchema = z.object({
  ...emailBaseShape,
  token: z.string().optional(),
});

export const EMAIL_DEFAULTS: EmailFormData = {
  name: "",
  from: "",
  baseUrl: RESEND_BASE_URL,
  credentialId: NEW_KEY,
  token: "",
};

/** A stored credential is linked as is; a new key is saved as a Resend credential. */
export function emailCreate(form: EmailFormData): ChannelCreate {
  const from = form.from.trim();
  return {
    name: form.name,
    baseUrl: form.baseUrl,
    token: form.token,
    credentialName: `Resend · ${from}`,
    credentialPublicConfig: { provider: RESEND_CREDENTIAL },
    ...(form.credentialId === NEW_KEY
      ? {}
      : { credentialProfileId: form.credentialId }),
    metadata: { from },
  };
}

/** `current`: the credential linked now. A key only rotates that one. */
export function emailUpdate(
  form: EmailFormData,
  current: string | null
): ChannelUpdate {
  const swapped =
    form.credentialId !== NEW_KEY && form.credentialId !== current;
  return {
    name: form.name,
    baseUrl: form.baseUrl,
    ...(swapped
      ? { credentialProfileId: form.credentialId }
      : { token: form.token }),
    metadata: { from: form.from.trim() },
  };
}

export function emailSender(connection: IntegrationConnection): string {
  const from = connection.metadata?.from;
  return typeof from === "string" ? from : "";
}

export function emailToForm(connection: IntegrationConnection): EmailFormData {
  return {
    name: connection.name,
    from: emailSender(connection),
    baseUrl: connection.baseUrl || RESEND_BASE_URL,
    credentialId: connection.credentialProfileId ?? NEW_KEY,
    token: "",
  };
}
