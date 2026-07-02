import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { Conversation } from "./conversation.types";

/**
 * How the conversation list is pivoted. Driver phone numbers are reused across services over time,
 * so the same thread can be viewed flat (most recent first), bucketed by the trip/service it's
 * currently tied to, or bucketed by driver. Grouping is a VIEW over the per-phone threads — we never
 * fork a conversation per trip, so an inbound reply always lands on one place.
 */
export type GroupBy = "recent" | "service" | "driver";

export interface ConversationGroup {
  readonly key: string;
  /** Section header text; {@code null} renders a flat list with no header (the "recent" view). */
  readonly label: string | null;
  readonly items: Conversation[];
}

/** Most-recently-active first; missing timestamps sort last. ISO strings compare chronologically. */
function byRecent(a: Conversation | undefined, b: Conversation | undefined): number {
  return (b?.lastMessageAt ?? "").localeCompare(a?.lastMessageAt ?? "");
}

export function groupConversations(
  conversations: Conversation[],
  groupBy: GroupBy,
  dict: I18nRecord,
): ConversationGroup[] {
  const sorted = [...conversations].sort(byRecent);

  if (groupBy === "recent") {
    return [{ key: "all", label: null, items: sorted }];
  }

  const keyOf = (c: Conversation): string =>
    groupBy === "service"
      ? (c.contextServiceCode ?? "")
      : (c.driverId ?? c.waContactName ?? c.phoneE164);

  const buckets = new Map<string, Conversation[]>();
  for (const conversation of sorted) {
    const key = keyOf(conversation);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(conversation);
    } else {
      buckets.set(key, [conversation]);
    }
  }

  const groups: ConversationGroup[] = [];
  for (const [key, items] of buckets) {
    const label =
      groupBy === "service"
        ? key || tr("noService", dict)
        : (items[0]?.waContactName ?? items[0]?.phoneE164 ?? tr("noDriver", dict));
    groups.push({ key: key || "__none__", label, items });
  }

  // Order groups by their most-recent conversation (items are already recency-sorted).
  return groups.sort((g1, g2) => byRecent(g1.items[0], g2.items[0]));
}
