import { getDictionary } from "@/features/i18n/i18n.service";
import { ServerDashboardsPage } from "@/features/dashboard/components/server-dashboards-page";

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ lang: string; slug: string }> }>) {
  const { lang, slug } = await params;
  const [, dictionary] = await getDictionary(lang);
  return (
    <ServerDashboardsPage lang={lang} slug={slug} dictionary={dictionary} />
  );
}
