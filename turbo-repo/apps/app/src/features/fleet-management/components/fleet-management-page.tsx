"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { fleetKpis, specialViews, vehicles } from "../data/fleet-mock-data";
import KpiCardsRow from "./kpi-cards/kpi-cards-row";
import SpecialViewsCarousel from "./special-views/special-views-carousel";
import VehicleGrid from "./vehicle-grid/vehicle-grid";
import VehicleDetailView from "./vehicle-detail/vehicle-detail-view";

interface FleetManagementPageProps {
  readonly dict: I18nRecord;
}

export default function FleetManagementPage({
  dict,
}: FleetManagementPageProps) {
  const fleetDict = dict["fleetManagement"] as I18nRecord;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedVehiclePlate = searchParams.get("vehicle");

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.plate === selectedVehiclePlate),
    [selectedVehiclePlate]
  );

  const handleSelectVehicle = useCallback(
    (plate: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("vehicle", plate);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const handleBack = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("vehicle");
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }, [searchParams, router, pathname]);

  if (selectedVehicle) {
    return (
      <div className="flex flex-col gap-6 p-4 max-w-screen-2xl mx-auto w-full">
        <VehicleDetailView
          vehicle={selectedVehicle}
          dict={fleetDict}
          onBack={handleBack}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-screen-2xl mx-auto w-full">
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

      <VehicleGrid
        vehicles={vehicles}
        dict={fleetDict}
        onSelectVehicle={handleSelectVehicle}
      />
    </div>
  );
}
