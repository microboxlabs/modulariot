"use server";
import "server-only";

import { promises as dns } from "dns";

type WebmailProvider = "gmail" | "outlook";

/**
 * Detects which webmail provider serves `email`'s domain by inspecting its
 * MX records (e.g. `*.google.com` -> Gmail, `*.outlook.com` -> Outlook),
 * the same lookup `dig -t mx <domain>` would show. Returns null when the
 * domain doesn't resolve or isn't served by a provider we know how to
 * deep-link into.
 */
async function detectWebmailProvider(
  email: string
): Promise<WebmailProvider | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  try {
    const records = await dns.resolveMx(domain);
    const exchanges = records.map((record) => record.exchange.toLowerCase());
    if (exchanges.some((host) => host.endsWith(".google.com"))) {
      return "gmail";
    }
    if (
      exchanges.some(
        (host) => host.endsWith(".outlook.com") || host.endsWith(".protection.outlook.com")
      )
    ) {
      return "outlook";
    }
    return null;
  } catch {
    // No MX records, NXDOMAIN, DNS timeout, etc. — treat as "can't detect".
    return null;
  }
}

function buildGmailSearchUrl(
  userEmail: string,
  senderDomain: string
): string {
  // The email must go in the `authuser` query param: Gmail resolves it to
  // the matching signed-in account internally, but putting it directly in
  // the `/u/` path segment (which only accepts the numeric session index)
  // 404s.
  const authuser = encodeURIComponent(userEmail);
  const query = encodeURIComponent(`from:${senderDomain} is:unread`);
  return `https://mail.google.com/mail/u/0/?authuser=${authuser}#search/${query}`;
}

function buildOutlookSearchUrl(senderDomain: string): string {
  const query = encodeURIComponent(`from:${senderDomain} isread:no`);
  return `https://outlook.office.com/mail/inbox?q=${query}`;
}

/**
 * Builds a deep link into the account-holder's own webmail, pre-filtered to
 * unread messages from `AUTH_VERIFICATION_EMAIL_SENDER` — so the register
 * wizard's "Ver correo" button can open the right inbox without knowing in
 * advance whether the user's domain is on Gmail or Outlook.
 *
 * Returns null when `AUTH_VERIFICATION_EMAIL_SENDER` is unset or the user's
 * mail provider can't be detected/isn't supported — callers should treat
 * that as "don't open anything".
 */
export async function getVerificationEmailSearchUrl(
  userEmail: string
): Promise<string | null> {
  const senderDomain = process.env.AUTH_VERIFICATION_EMAIL_SENDER;
  if (!senderDomain || !userEmail) return null;

  const provider = await detectWebmailProvider(userEmail);
  switch (provider) {
    case "gmail":
      return buildGmailSearchUrl(userEmail, senderDomain);
    case "outlook":
      return buildOutlookSearchUrl(senderDomain);
    default:
      return null;
  }
}
