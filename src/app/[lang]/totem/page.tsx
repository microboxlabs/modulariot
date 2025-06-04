import Totem from "@/features/totem/totem";
import { getDictionary } from "@/features/i18n/i18n.service";
import { defaultLocale } from "@/features/i18n/tr.service";

export default async function TotemPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const [_dict, dictionary] = await getDictionary(lang ?? defaultLocale);

  return <Totem dict={dictionary} />;
}
