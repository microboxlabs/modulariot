/**
 * The channel types an organization can send through. A new type is a new entry
 * here plus its logo in `channel-icon.tsx` and its name in the dictionaries.
 */
export interface ChannelType {
  readonly key: string;
  /** What a step on this channel names as its recipient; `connection` channels call one of the organization's connections. */
  readonly recipient: "phone" | "email" | "connection";
  /** The platform runs an account for it that any organization can use. */
  readonly platformOffered: boolean;
}

export const CHANNEL_TYPES: readonly ChannelType[] = [
  { key: "whatsapp", recipient: "phone", platformOffered: true },
  { key: "email", recipient: "email", platformOffered: true },
  { key: "slack", recipient: "connection", platformOffered: false },
  { key: "teams", recipient: "connection", platformOffered: false },
  { key: "webhook", recipient: "connection", platformOffered: false },
];

export const channelType = (key: string) =>
  CHANNEL_TYPES.find((c) => c.key === key);

/** Channels whose steps call an organization connection instead of writing to people. */
export const isConnectionChannel = (key: string) =>
  channelType(key)?.recipient === "connection";
