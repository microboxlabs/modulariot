"use client";

import { useUserSite } from "@/features/common/providers/client-api.provider";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { CreateDashboardButton } from "./create-dashboard-button";
import { DashboardList } from "./dashboard-list";

interface DashboardLandingClientProps {
  dict: I18nRecord;
  ctaLabel: string;
}

export function DashboardLandingClient({
  dict,
  ctaLabel,
}: Readonly<DashboardLandingClientProps>) {
  const { siteName } = useUserSite();

  return (
    <>
      <CreateDashboardButton
        dict={dict}
        ctaLabel={ctaLabel}
        siteName={siteName}
      />

      <div className="mt-12 w-full max-w-3xl">
        <DashboardList dict={dict} />
      </div>
    </>
  );
}
