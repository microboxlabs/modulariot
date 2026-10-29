import { getDictionary } from "@/features/i18n/i18n.service";
import { tr } from "@/features/i18n/tr.service";
import { DashboardLandingHero } from "./dashboard-landing-hero";
import { DashboardLandingClient } from "./dashboard-landing-client";

interface DashboardLandingProps {
  lang: string;
}

export async function DashboardLanding({
  lang,
}: Readonly<DashboardLandingProps>) {
  const [, dict] = await getDictionary(lang);

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <DashboardLandingHero dict={dict} />
      <DashboardLandingClient
        dict={dict}
        ctaLabel={tr("cta", dict.dashboard.landing)}
      />
    </div>
  );
}
