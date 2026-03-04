"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { fleetKpis, specialViews, vehicles } from "../data/fleet-mock-data";
import KpiCardsRow from "./kpi-cards/kpi-cards-row";
import SpecialViewsCarousel from "./special-views/special-views-carousel";
import VehicleGrid from "./vehicle-grid/vehicle-grid";

interface FleetManagementPageProps {
  readonly dict: I18nRecord;
}

export default function FleetManagementPage({
  dict,
}: FleetManagementPageProps) {
  const fleetDict = dict["fleetManagement"] as I18nRecord;

  return (
    <div className="flex flex-col gap-6 p-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {tr("title", fleetDict)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("subtitle", fleetDict)}
        </p>
      </div>

      <KpiCardsRow kpis={fleetKpis} dict={fleetDict} />

      <SpecialViewsCarousel views={specialViews} dict={fleetDict} />

      <VehicleGrid vehicles={vehicles} dict={fleetDict} />
    </div>
  );
}
