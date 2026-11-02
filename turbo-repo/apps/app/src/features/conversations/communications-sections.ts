import { CHANNEL_TYPES } from "./channel-types";

/** `channel:<key>` is one of `CHANNEL_TYPES`. */
export type CommunicationsSection =
  | "rules"
  | "activity"
  | "templates"
  | "meta"
  | `channel:${string}`;

export const DEFAULT_SECTION: CommunicationsSection = "rules";

export const channelSection = (key: string): CommunicationsSection =>
  `channel:${key}`;

export const COMMUNICATIONS_SECTIONS: readonly CommunicationsSection[] = [
  "rules",
  "activity",
  "templates",
  ...CHANNEL_TYPES.map((c) => channelSection(c.key)),
];

/**
 * In the platform scope Comunicaciones edits the message templates, shows the WhatsApp templates on Meta,
 * sets up the accounts the platform offers, and holds the platform's own rules, such as the geocoding quota alerts.
 */
export const PLATFORM_SECTIONS: readonly CommunicationsSection[] = [
  "templates",
  "meta",
  "rules",
  "activity",
  ...CHANNEL_TYPES.filter((c) => c.platformOffered).map((c) =>
    channelSection(c.key)
  ),
];

export const sectionsFor = (platformScope: boolean) =>
  platformScope ? PLATFORM_SECTIONS : COMMUNICATIONS_SECTIONS;

/** The section in `?section=`; the old `?tab=activity` links still open Actividad. */
export function sectionOf(
  params: URLSearchParams,
  platformScope = false
): CommunicationsSection {
  const allowed = sectionsFor(platformScope);
  const value = params.get("section") ?? params.get("tab");
  return allowed.find((s) => s === value) ?? allowed[0];
}

export const channelKeyOf = (section: CommunicationsSection) =>
  section.startsWith("channel:") ? section.slice("channel:".length) : null;
