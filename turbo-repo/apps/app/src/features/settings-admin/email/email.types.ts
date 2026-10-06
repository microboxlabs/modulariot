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

const emailBaseShape = {
  name: z.string().min(1, "validation.nameRequired"),
  from: z.string().refine(isSender, "validation.fromInvalid"),
  baseUrl: z.string().url("validation.baseUrlInvalid"),
};

/** Create form. Messages are dictionary keys, resolved with trDynamic. */
export const EmailConnectionSchema = z.object({
  ...emailBaseShape,
  token: z.string().min(1, "validation.tokenRequired"),
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
  token: "",
};

/** The API key becomes a bearer credential; the sender goes in the connection metadata. */
export function emailCreate(form: EmailFormData): ChannelCreate {
  return {
    name: form.name,
    baseUrl: form.baseUrl,
    token: form.token,
    credentialName: `Resend · ${form.from.trim()}`,
    metadata: { from: form.from.trim() },
  };
}

export function emailUpdate(form: EmailFormData): ChannelUpdate {
  return {
    name: form.name,
    baseUrl: form.baseUrl,
    token: form.token,
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
    token: "",
  };
}
