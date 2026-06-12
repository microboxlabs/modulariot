import { redirect } from "next/navigation";
import { defaultLocale } from "@/features/i18n/tr.service";

/**
 * Lang-less sign-in shim.
 *
 * NextAuth's `pages.signIn`/`pages.error` are static strings ("/app/sign-in"),
 * and a few call sites redirect to "/sign-in" without a locale. The real
 * sign-in page lives under `[lang]/sign-in`, so "/app/sign-in" would otherwise
 * match `[lang]` with `lang="sign-in"` and render the Next.js boilerplate page.
 *
 * This static route takes precedence over the dynamic `[lang]` segment for the
 * exact "/sign-in" path and forwards to the localized sign-in page, preserving
 * query params (e.g. `error=AccessDenied`, `callbackUrl`).
 */
export default async function SignInLocaleRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const query = qs.toString();
  redirect(`/${defaultLocale}/sign-in${query ? `?${query}` : ""}`);
}
