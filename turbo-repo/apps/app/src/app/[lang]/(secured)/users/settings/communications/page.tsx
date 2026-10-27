import "server-only";
import { Suspense } from "react";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import CommunicationsPage from "@/features/conversations/communications-page";

/** Settings › Comunicaciones: conversation rules, templates and activity. */
export default async function CommunicationsSettingsPage({
  params,
}: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;
  const connectionsDict = (dictionary.pages as I18nRecord)
    ?.integrationConnections as I18nRecord;

  return (
    <RouteGuard path="/users/settings/communications">
      <Suspense>
        <CommunicationsPage
          dict={userSettings}
          connectionsDict={connectionsDict ?? {}}
          lang={lang}
        />
      </Suspense>
    </RouteGuard>
  );
}
