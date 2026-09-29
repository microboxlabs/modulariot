import { getDictionary } from "@/features/i18n/i18n.service";
import type { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { ServerDashboardsPage } from "@/features/dashboard/components/server-dashboards-page";

export default async function Page({ params }: Readonly<ParamsWithLang>) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  return <ServerDashboardsPage lang={lang} dictionary={dictionary} />;
}
