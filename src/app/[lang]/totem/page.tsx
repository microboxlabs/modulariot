import Totem from "@/features/totem/totem";
import { getDictionary, getLocaleFromHeaders } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { headers } from "next/headers";
import { defaultLocale } from "@/features/i18n/tr.service";

export default async function TotemPage({ params: { lang } }: { params: { lang: string } }) {
  const [dict, dictionary] = await getDictionary(lang ?? defaultLocale);

  return (
    <Totem dict={dictionary} />
  );
}
