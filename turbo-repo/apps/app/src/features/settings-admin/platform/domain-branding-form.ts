"use client";

/**
 * Client-side mirrors of the modulith's `LogoImage` and `HomeUrl` validation.
 *
 * Duplicated deliberately: the server stays the authority, but a 350 KB upload
 * that only fails after the round trip is a poor way to learn the file is a
 * PDF. Both sets of rules are small and stable; the tests below name the Java
 * classes so the two move together.
 */

/** `LogoImage.MAX_BYTES`. */
export const MAX_LOGO_BYTES = 256 * 1024;

/** `LogoImage.ALLOWED_MIMES`, and `chk_domain_branding_mime` in V0.1.5. */
export const ALLOWED_LOGO_MIMES = [
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** The `accept` attribute for the file input, from the same allowlist. */
export const LOGO_ACCEPT = ALLOWED_LOGO_MIMES.join(",");

export type LogoProblem = "type" | "empty" | "size";

export function checkLogoFile(file: {
  type: string;
  size: number;
}): LogoProblem | null {
  const mime = file.type.trim().toLowerCase();
  if (!ALLOWED_LOGO_MIMES.some((allowed) => allowed === mime)) return "type";
  if (file.size === 0) return "empty";
  if (file.size > MAX_LOGO_BYTES) return "size";
  return null;
}

/**
 * Reads a picked file as the `data:<mime>;base64,<...>` URL the PUT body
 * carries. `readAsDataURL` always base64-encodes, which is the only form
 * `LogoImage.fromDataUrl` accepts.
 */
export function readLogoDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the logo file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read the logo file"));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

/** `HomeUrl.MAX_LENGTH`. */
const MAX_HOME_URL_LENGTH = 2048;

export type HomeUrlProblem = "length" | "malformed" | "scheme" | "userInfo";

/**
 * The value is rendered into an anchor's `href` on the unauthenticated
 * sign-in page, so the scheme is restricted and embedded credentials are
 * refused — `https://www.trusted.example@evil.example` reads as one host and
 * navigates to another.
 *
 * @returns why the URL is unusable, or null when it is fine (blank included:
 *     an absent home URL just leaves the logo unlinked)
 */
export function checkHomeUrl(raw: string): HomeUrlProblem | null {
  const value = raw.trim();
  if (value.length === 0) return null;
  if (value.length > MAX_HOME_URL_LENGTH) return "length";

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "malformed";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "scheme";
  if (!url.hostname) return "malformed";
  if (url.username || url.password) return "userInfo";
  return null;
}
