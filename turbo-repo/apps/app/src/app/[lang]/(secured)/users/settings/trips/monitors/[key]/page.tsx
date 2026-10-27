import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import MonitorEditor from "@/features/trips/monitors/monitor-editor";

/** Settings › Viajes › one monitor. */
export default async function TripMonitorPage({
  params,
}: Readonly<{ params: Promise<{ lang: string; key: string }> }>) {
  const { lang, key } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/trips">
      <MonitorEditor
        monitorKey={decodeURIComponent(key)}
        dict={userSettings}
        lang={lang}
      />
    </RouteGuard>
  );
}
