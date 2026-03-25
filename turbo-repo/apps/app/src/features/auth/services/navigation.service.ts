import "server-only";
import { redirect } from "next/navigation";
import { getLocaleFromHeaders } from "@/features/i18n/i18n.service";
import { headers } from "next/headers";

export async function redirectWithLang(relativePath: string): Promise<never> {
  const lang = getLocaleFromHeaders(await headers());
  redirect(`/${lang}${relativePath}`);
}
