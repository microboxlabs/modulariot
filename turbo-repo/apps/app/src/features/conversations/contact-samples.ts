/**
 * The book's contacts as the samples beside a contact condition's CEL, so a
 * field can be dragged into the condition the way the rule sheet drags a
 * source's fields: `contact` as the server builds it, and `event.data` with
 * the fields the condition can read.
 */

import type { TowerContact } from "@/features/symptoms/control-tower/control-tower-api";
import type { EventField } from "./conversations-types";

/** How many contacts the tree pages through. */
export const MAX_CONTACT_SAMPLES = 20;

const text = (v: string | null | undefined) => v ?? "";

/** The `contact` map a condition reads, as Audiences.contactVars builds it on the server. */
export function contactVars(c: TowerContact): Record<string, unknown> {
  const ch = c.channels ?? {};
  return {
    name: text(c.name),
    role: text(c.role),
    tags: c.tags ?? [],
    company: text(c.company),
    companyRut: text(c.companyRut),
    nationalId: text(c.nationalId),
    position: text(c.position),
    member: Boolean(c.memberUserId),
    email: text(ch.email),
    whatsapp: text(ch.whatsapp ?? c.phone),
  };
}

/** One sample per active contact, with the event's fields empty: their values come with each event. */
export function contactSamples(
  contacts: readonly TowerContact[],
  fields: readonly EventField[]
): { samples: Record<string, unknown>[]; labels: string[] } {
  const data = Object.fromEntries(fields.map((f) => [f.name, ""]));
  const shown = contacts.filter((c) => c.active).slice(0, MAX_CONTACT_SAMPLES);
  return {
    samples: shown.map((c) => ({ contact: contactVars(c), event: { data } })),
    labels: shown.map((c) => c.name),
  };
}
