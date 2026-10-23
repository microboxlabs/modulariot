/** What a notice on a channel type asks for as its recipient. */
type Recipient = "email" | "phone" | "channel" | "none";

export interface ChannelType {
  key: string;
  /** Dictionary key of its name. */
  label: string;
  recipient: Recipient;
}

/**
 * The channel types a notice can name. A notice goes out through the
 * organization's channel of its type (#2002); this list moves to a table later.
 */
export const CHANNEL_TYPES: ChannelType[] = [
  { key: "email", label: "channelEmail", recipient: "email" },
  { key: "whatsapp", label: "channelWhatsapp", recipient: "phone" },
  { key: "teams", label: "channelTeams", recipient: "channel" },
  { key: "slack", label: "channelSlack", recipient: "channel" },
  { key: "webhook", label: "channelWebhook", recipient: "none" },
];

export function channelType(key: string | null): ChannelType | undefined {
  return CHANNEL_TYPES.find((c) => c.key === key);
}

const RECIPIENT_HINT: Record<Recipient, string> = {
  email: "recipientEmail",
  phone: "recipientPhone",
  channel: "recipientChannel",
  none: "recipientNone",
};

/** Dictionary key of the recipient field's placeholder for a channel type. */
export function recipientHint(key: string | null): string {
  const type = channelType(key);
  return type ? RECIPIENT_HINT[type.recipient] : "recipientPlaceholder";
}
