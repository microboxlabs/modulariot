import { z } from "zod";
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

/** The channel links a stored Resend credential; the key itself lives in Credentials. */
export const EmailConnectionSchema = z.object({
  name: z.string().min(1, "validation.nameRequired"),
  from: z.string().refine(isSender, "validation.fromInvalid"),
  baseUrl: z.string().url("validation.baseUrlInvalid"),
  credentialId: z.string().min(1, "validation.credentialRequired"),
});

export type EmailFormData = z.infer<typeof EmailConnectionSchema>;

export const EMAIL_DEFAULTS: EmailFormData = {
  name: "",
  from: "",
  baseUrl: RESEND_BASE_URL,
  credentialId: "",
};

export function emailCreate(form: EmailFormData): ChannelCreate {
  return {
    name: form.name,
    baseUrl: form.baseUrl,
    credentialProfileId: form.credentialId,
    metadata: { from: form.from.trim() },
  };
}

/** `current`: the credential linked now; only a different one is sent. */
export function emailUpdate(
  form: EmailFormData,
  current: string | null
): ChannelUpdate {
  return {
    name: form.name,
    baseUrl: form.baseUrl,
    ...(form.credentialId === current
      ? {}
      : { credentialProfileId: form.credentialId }),
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
    credentialId: connection.credentialProfileId ?? "",
  };
}
