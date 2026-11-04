/**
 * The link that opens a channel's app for a contact: the phone dialer, or a
 * WhatsApp chat with the step's message already typed. Meet and Teams have no
 * contact address in the book, so they open nothing; the call is still timed.
 */

import type { CallMethod } from "./call-method";

/** The number's digits with the country code, as wa.me and tel: take it: `+56 9 1234 5678` → `56912345678`. */
export function phoneDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function channelLink(
  method: CallMethod,
  phone: string | null | undefined,
  message: string
): string | null {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  if (method === "phone") return `tel:+${digits}`;
  if (method === "whatsapp") {
    const text = message.trim();
    return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  }
  return null;
}
