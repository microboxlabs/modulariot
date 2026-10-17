import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import GeographicViewShell from "@/features/geographic-view/components/geographic-view-shell";

export default async function GeographicViewPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);

  return <GeographicViewShell lang={lang} dict={dict as I18nRecord} />;
}
