import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import FleetPage from "@/features/fleet/components/fleet-page";

/** Fleet: the organization's assets, filled from GPS signals and trips. */
export default async function FleetRoute({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.pages as I18nRecord)?.fleet as I18nRecord;

  return (
    <RouteGuard path="/fleet" fallbackPath={`/${lang}/shipping`}>
      <FleetPage dict={dict ?? {}} lang={lang} />
    </RouteGuard>
  );
}
