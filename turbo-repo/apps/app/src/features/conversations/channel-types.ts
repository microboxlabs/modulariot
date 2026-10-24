/**
 * The channel types an organization can send through. A new type is a new entry
 * here plus its logo in `channel-icon.tsx` and its name in the dictionaries.
 */
export interface ChannelType {
  readonly key: string;
  /** What a step addressed to this channel names as its recipient. */
  readonly recipient: "phone" | "email" | "channel";
  /** The platform runs an account for it that any organization can use. */
  readonly platformOffered: boolean;
}

export const CHANNEL_TYPES: readonly ChannelType[] = [
  { key: "whatsapp", recipient: "phone", platformOffered: true },
  { key: "email", recipient: "email", platformOffered: true },
  { key: "slack", recipient: "channel", platformOffered: false },
  { key: "teams", recipient: "channel", platformOffered: false },
];

export const channelType = (key: string) =>
  CHANNEL_TYPES.find((c) => c.key === key);
