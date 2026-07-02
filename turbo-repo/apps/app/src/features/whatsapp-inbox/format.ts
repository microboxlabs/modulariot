import type { Conversation } from "./conversation.types";

/** Display label for a conversation: the WhatsApp contact name, or the phone if we have no name. */
export function conversationName(conversation: Conversation): string {
  return conversation.waContactName?.trim() || conversation.phoneE164;
}

/** HH:MM in the active app locale; empty string for a missing timestamp. */
export function formatClockTime(iso: string | null, locale: string): string {
  const date = parseDate(iso);
  return date ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "";
}

/**
 * Compact timestamp for the conversation list: clock time when it happened today, otherwise the
 * short date. Formatted in the active app locale, so /en and /es render consistently.
 */
export function formatListTime(iso: string | null, locale: string): string {
  const date = parseDate(iso);
  if (!date) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
}

function parseDate(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
