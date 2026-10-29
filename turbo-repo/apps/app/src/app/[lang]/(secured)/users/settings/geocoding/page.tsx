import "server-only";
import { Suspense } from "react";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import GeocodingPageContent from "@/features/geocoding/geocoding-page-content";

/** Settings › Geocodificación: review queue, provider connection and monthly usage. */
export default async function GeocodingSettingsPage({
  params,
}: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/geocoding">
      <Suspense>
        <GeocodingPageContent dict={userSettings} lang={lang} />
      </Suspense>
    </RouteGuard>
  );
}
