import "server-only";
import { notFound } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ServerDashboardsPage } from "@/features/dashboard/components/server-dashboards-page";

const isDashboardServerEnabled = process.env.ENABLE_DASHBOARD_SERVER === "true";

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ lang: string; slug: string }> }>) {
  if (!isDashboardServerEnabled) {
    notFound();
  }

  const { lang, slug } = await params;
  const [, dictionary] = await getDictionary(lang);
  return (
    <ServerDashboardsPage lang={lang} slug={slug} dictionary={dictionary} />
  );
}
