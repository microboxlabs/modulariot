"use client";

import { useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { truckToVehicle } from "../data/fleet-adapters";
import { useFleetTruck } from "../hooks/use-fleet-truck";
import VehicleDetailView from "./vehicle-detail/vehicle-detail-view";

interface VehicleDetailPageProps {
  readonly dict: I18nRecord;
  readonly plate: string;
}

export default function VehicleDetailPage({
  dict,
  plate,
}: VehicleDetailPageProps) {
  const fleetDict = dict["fleetManagement"] as I18nRecord;
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();

  const { truck, notFound, error, isLoading } = useFleetTruck(plate, {
    includeMetrics: true,
    metricFields:
      "timestamp,odometer_km,fuel_volume_ml,fuel_level_pct,latitude,longitude",
  });

  const vehicle = useMemo(
    () => (truck ? truckToVehicle(truck) : null),
    [truck]
  );

  const handleBack = useCallback(() => {
    router.push(`/${lang}/fleet-management`);
  }, [router, lang]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
          <span className="text-sm">{tr("vehicleGrid.loading", fleetDict)}</span>
        </div>
      </div>
    );
  }

  if (notFound || (!isLoading && !vehicle && !error)) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-3 p-6">
        <p className="text-base text-gray-700 dark:text-gray-300">
          {tr("vehicleGrid.emptyTitle", fleetDict)}
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {tr("vehicleDetail.back", fleetDict)}
        </button>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-3 p-6">
        <p className="text-base text-red-600 dark:text-red-400">
          {tr("vehicleGrid.emptyDescription", fleetDict)}
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {tr("vehicleDetail.back", fleetDict)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full mx-auto h-full">
      <VehicleDetailView
        vehicle={vehicle}
        dict={fleetDict}
        onBack={handleBack}
      />
    </div>
  );
}
