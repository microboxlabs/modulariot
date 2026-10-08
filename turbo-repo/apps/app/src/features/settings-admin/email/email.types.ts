import { z } from "zod";
import type {
  ChannelCreate,
  ChannelUpdate,
  IntegrationConnection,
} from "../channels/channel.types";

export const RESEND_PROVIDER = "RESEND";
/** The backend only sends to its configured Resend API; this is its default. */
export const RESEND_BASE_URL = "https://api.resend.com";

function isAddress(address: string): boolean {
  const at = address.indexOf("@");
  const dot = address.lastIndexOf(".");
  return (
    !/[\s<>]/.test(address) &&
    at > 0 &&
    at === address.lastIndexOf("@") &&
    dot > at + 1 &&
    dot < address.length - 1
  );
}

/** `address@domain.tld` or `Name <address@domain.tld>`, as the backend accepts. */
export function isSender(value: string): boolean {
  const sender = value.trim();
  const open = sender.indexOf("<");
  if (open < 0 && !sender.includes(">")) return isAddress(sender);
  const named =
    open >= 0 &&
    open === sender.lastIndexOf("<") &&
    sender.indexOf(">") === sender.length - 1;
  return named && isAddress(sender.slice(open + 1, -1));
}

/** The channel links a stored Resend credential; the key itself lives in Credentials. */
export const EmailConnectionSchema = z.object({
  name: z.string().min(1, "validation.nameRequired"),
  from: z.string().refine(isSender, "validation.fromInvalid"),
  credentialId: z.string().min(1, "validation.credentialRequired"),
});

export type EmailFormData = z.infer<typeof EmailConnectionSchema>;

export const EMAIL_DEFAULTS: EmailFormData = {
  name: "",
  from: "",
  credentialId: "",
};

export function emailCreate(form: EmailFormData): ChannelCreate {
  return {
    name: form.name,
    baseUrl: RESEND_BASE_URL,
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
    baseUrl: RESEND_BASE_URL,
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
    credentialId: connection.credentialProfileId ?? "",
  };
}
