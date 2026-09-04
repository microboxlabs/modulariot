import "server-only";
import { notFound } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import HarnessPageContent from "@/features/settings-admin/components/harness-page-content";

/** Harness seats, usage, and per-user access controls. */
export default async function HarnessSettingsPage({ params }: ParamsWithLang) {
  // Server-only flag: kept off NEXT_PUBLIC_ so it never ships to the client
  // bundle. This page is a preview ahead of the real billing integration —
  // 404 unless explicitly enabled. The sidebar link is gated on the same
  // flag server-side too, via SecuredLayout -> SecuredSidebar (see
  // sidebar-navigation-context.tsx), so it never dead-ends to this 404.
  if (process.env.ENABLE_HARNESS_SETTINGS !== "true") {
    notFound();
  }

  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard
      path="/users/settings/harness"
      fallbackPath={`/${lang}/shipping`}
    >
      <HarnessPageContent dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}
