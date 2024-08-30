import "server-only";
import { redirect } from "next/navigation";
import { getLocaleFromHeaders } from "@/features/i18n/i18n.service";
import { headers } from "next/headers";

export function redirectWithLang(relativePath: string): never {
  const lang = getLocaleFromHeaders(headers());
  redirect(`/${lang}${relativePath}`);
}
