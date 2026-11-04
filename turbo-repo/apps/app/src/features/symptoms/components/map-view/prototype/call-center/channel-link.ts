/**
 * The link that opens a channel's app for a contact: the phone dialer, or a
 * WhatsApp chat with the step's message already typed. Meet and Teams have no
 * contact address in the book, so they open nothing; the call is still timed.
 */

import type { CallMethod } from "./call-method";

/** The number's digits with the country code, as wa.me and tel: take it: `+1 202 555 0101` → `12025550101`. */
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

/** A Teams Phone call to a number: the desktop app's link, and the web link to fall back on. */
export function teamsCallLinks(
  phone: string | null | undefined
): { app: string; web: string } | null {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  const path = `/l/call/0/0?users=4:+${digits}`;
  return { app: `msteams:${path}`, web: `https://teams.microsoft.com${path}` };
}

/** The window methods `openTeamsCall` uses; a test passes a fake. */
export interface TeamsWindow {
  location: { href: string };
  open: (url: string, target: string, features: string) => unknown;
  addEventListener: (type: "blur", cb: () => void) => void;
  removeEventListener: (type: "blur", cb: () => void) => void;
  setTimeout: (cb: () => void, ms: number) => unknown;
}

/**
 * Opens the call in the Teams app. When the page keeps the focus for
 * `fallbackMs` (no app took the link), opens Teams on the web instead.
 */
export function openTeamsCall(
  links: { app: string; web: string },
  win: TeamsWindow = window as unknown as TeamsWindow,
  fallbackMs = 1500
): void {
  let left = false;
  const onBlur = () => {
    left = true;
  };
  win.addEventListener("blur", onBlur);
  win.location.href = links.app;
  win.setTimeout(() => {
    win.removeEventListener("blur", onBlur);
    if (!left) win.open(links.web, "_blank", "noopener,noreferrer");
  }, fallbackMs);
}
