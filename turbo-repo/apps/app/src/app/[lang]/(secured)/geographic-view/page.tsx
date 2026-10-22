import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import GeographicViewShell from "@/features/geographic-view/components/geographic-view-shell";
import { guardPage } from "@/features/auth/access/server-access";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";
import { RouteGuard } from "@/features/auth/components/route-guard";

export default async function GeographicViewPage({ params }: ParamsWithLang) {
  await guardPage(ACCESS_RULES.geographic, "/geographic-view");
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);

  return (
    <RouteGuard path="/geographic-view">
      <GeographicViewShell lang={lang} dict={dict as I18nRecord} />
    </RouteGuard>
  );
}
