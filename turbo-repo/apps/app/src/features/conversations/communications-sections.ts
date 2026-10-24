import { CHANNEL_TYPES } from "./channel-types";

/** `rules`, `activity`, or `channel:<key>` for one of `CHANNEL_TYPES`. */
export type CommunicationsSection = string;

export const DEFAULT_SECTION: CommunicationsSection = "rules";

export const channelSection = (key: string): CommunicationsSection =>
  `channel:${key}`;

export const COMMUNICATIONS_SECTIONS: readonly CommunicationsSection[] = [
  "rules",
  "activity",
  ...CHANNEL_TYPES.map((c) => channelSection(c.key)),
];

/** The section in `?section=`; the old `?tab=activity` links still open Actividad. */
export function sectionOf(params: URLSearchParams): CommunicationsSection {
  const value = params.get("section") ?? params.get("tab");
  return value && COMMUNICATIONS_SECTIONS.includes(value)
    ? value
    : DEFAULT_SECTION;
}

export const channelKeyOf = (section: CommunicationsSection) =>
  section.startsWith("channel:") ? section.slice("channel:".length) : null;
