"use client";

import { useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { truckToVehicle } from "../data/fleet-adapters";
import { useFleetTruck } from "../hooks/use-fleet-truck";
import { useFleetTrucks } from "../hooks/use-fleet-trucks";
import type { Vehicle } from "../types/fleet.types";
import VehicleDetailView from "./vehicle-detail/vehicle-detail-view";

interface VehicleDetailPageProps {
  readonly dict: I18nRecord;
  readonly plate: string;
}

/**
 * Walk the vehicle list to find prev/next neighbors for the current plate.
 * Returns null when the list is still loading or the plate isn't found.
 */
function computeNeighborNav(
  list: Vehicle[],
  plate: string
): { prevPlate: string | null; nextPlate: string | null } | null {
  if (list.length === 0) return null;
  const idx = list.findIndex((v) => v.plate === plate);
  if (idx === -1) return null;
  return {
    prevPlate: idx > 0 ? list[idx - 1].plate : null,
    nextPlate: idx < list.length - 1 ? list[idx + 1].plate : null,
  };
}

export default function VehicleDetailPage({
  dict,
  plate,
}: VehicleDetailPageProps) {
  const fleetDict = dict["fleetManagement"] as I18nRecord;
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();
  const searchParams = useSearchParams();

  const { truck, notFound, error, isLoading } = useFleetTruck(plate, {
    includeMetrics: true,
    metricFields:
      "timestamp,odometer_km,fuel_volume_ml,fuel_level_pct,latitude,longitude",
  });

  // Pull the full list for prev/next navigation. SWR dedupes against the
  // list page's call so there's no extra network cost when the user came
  // here via a card click; direct URL hits pay one fetch for navigation.
  const { trucks } = useFleetTrucks({
    size: 9999,
    includeMetrics: true,
    metricFields:
      "timestamp,odometer_km,fuel_volume_ml,fuel_level_pct,latitude,longitude",
  });

  const allVehicles = useMemo(() => trucks.map(truckToVehicle), [trucks]);

  // Apply the same filters as the list page so navigation respects the
  // current search/filter context carried via URL search params.
  const filteredVehicles = useMemo(() => {
    const plateFilter = (searchParams.get("licensePlate") ?? "")
      .trim()
      .toLowerCase();
    const clientFilter = (searchParams.get("client") ?? "")
      .trim()
      .toLowerCase();
    const stateFilter = (searchParams.get("state") ?? "")
      .trim()
      .toLowerCase();

    if (!plateFilter && !clientFilter && !stateFilter) return allVehicles;

    return allVehicles.filter((v) => {
      if (plateFilter && !v.plate.toLowerCase().includes(plateFilter))
        return false;
      if (clientFilter && !v.transportist.toLowerCase().includes(clientFilter))
        return false;
      if (stateFilter && v.status !== stateFilter) return false;
      return true;
    });
  }, [allVehicles, searchParams]);

  const vehicle = useMemo(
    () => (truck ? truckToVehicle(truck) : null),
    [truck]
  );

  const navigation = useMemo(
    () => computeNeighborNav(filteredVehicles, plate),
    [filteredVehicles, plate]
  );

  const handleBack = useCallback(() => {
    const qs = searchParams.toString();
    const base = `/${lang}/fleet-management`;
    router.push(qs ? `${base}?${qs}` : base);
  }, [router, lang, searchParams]);

  const handlePrevious = useCallback(() => {
    if (navigation?.prevPlate) {
      const qs = searchParams.toString();
      const base = `/${lang}/fleet-management/${encodeURIComponent(navigation.prevPlate)}`;
      router.push(qs ? `${base}?${qs}` : base);
    }
  }, [navigation, router, lang, searchParams]);

  const handleNext = useCallback(() => {
    if (navigation?.nextPlate) {
      const qs = searchParams.toString();
      const base = `/${lang}/fleet-management/${encodeURIComponent(navigation.nextPlate)}`;
      router.push(qs ? `${base}?${qs}` : base);
    }
  }, [navigation, router, lang, searchParams]);

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
        previous={{
          hasPrevious: navigation?.prevPlate !== null && navigation !== null,
          onPrevious: handlePrevious,
        }}
        next={{
          hasNext: navigation?.nextPlate !== null && navigation !== null,
          onNext: handleNext,
        }}
      />
    </div>
  );
}
