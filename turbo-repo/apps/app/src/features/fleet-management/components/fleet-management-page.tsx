"use client";

import {
  useParams,
  useRouter,
  usePathname,
  useSearchParams,
} from "next/navigation";
import { useCallback, useMemo } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { truckToVehicle } from "../data/fleet-adapters";
import { pgrestRowToSpecialView } from "../data/fleet-special-views-adapter";
import { useFleetTrucks } from "../hooks/use-fleet-trucks";
import { useSpecialViews } from "../hooks/use-special-views";
import KpiCardsRow from "./kpi-cards/kpi-cards-row";
import SpecialViewsCarousel from "./special-views/special-views-carousel";
import VehicleGrid from "./vehicle-grid/vehicle-grid";
import type { FleetKpi, VehicleStatus } from "../types/fleet.types";
import {
  HiOutlineTruck,
  HiOutlineCheckCircle,
  HiOutlineWrenchScrewdriver,
  HiOutlineExclamationTriangle,
  HiOutlineNoSymbol,
} from "react-icons/hi2";

interface FleetManagementPageProps {
  readonly dict: I18nRecord;
}

export default function FleetManagementPage({
  dict,
}: FleetManagementPageProps) {
  const fleetDict = dict["fleetManagement"] as I18nRecord;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useParams<{ lang: string }>();

  const { trucks, isLoading } = useFleetTrucks({
    size: 9999,
    includeMetrics: true,
    metricFields: "timestamp,odometer_km,fuel_volume_ml,fuel_level_pct,latitude,longitude",
  });

  const vehicles = useMemo(() => trucks.map(truckToVehicle), [trucks]);

  // URL-driven filters from the navbar searchbar (see navegation_params.ts
  // entry for `fleet-management`). KPIs stay based on the unfiltered fleet so
  // they always show totals; only the grid below reflects the filter.
  const filteredVehicles = useMemo(() => {
    const plateFilter = (searchParams.get("licensePlate") ?? "")
      .trim()
      .toLowerCase();
    const clientFilter = (searchParams.get("client") ?? "").trim().toLowerCase();
    const stateFilter = (searchParams.get("state") ?? "").trim().toLowerCase();

    if (!plateFilter && !clientFilter && !stateFilter) return vehicles;

    return vehicles.filter((v) => {
      if (plateFilter && !v.plate.toLowerCase().includes(plateFilter)) {
        return false;
      }
      if (
        clientFilter &&
        !v.transportist.toLowerCase().includes(clientFilter)
      ) {
        return false;
      }
      if (stateFilter && v.status !== stateFilter) return false;
      return true;
    });
  }, [vehicles, searchParams]);

  const { rows: specialViewRows } = useSpecialViews();
  const specialViews = useMemo(() => {
    const locale = lang === "es" ? "es" : "en";
    return specialViewRows.map((row) => pgrestRowToSpecialView(row, locale));
  }, [specialViewRows, lang]);

  const kpis: FleetKpi[] = useMemo(() => {
    return [
      {
        id: "total",
        labelKey: "totalFleet",
        value: vehicles.length,
        icon: HiOutlineTruck,
        color: "text-blue-600 bg-blue-100",
        darkColor: "dark:text-blue-400 dark:bg-blue-900/30",
      },
      {
        id: "active",
        labelKey: "active",
        value: vehicles.filter((v) => v.status === "active").length,
        icon: HiOutlineCheckCircle,
        color: "text-green-600 bg-green-100",
        darkColor: "dark:text-green-400 dark:bg-green-900/30",
        state: "active",
      },
      {
        id: "maintenance",
        labelKey: "inMaintenance",
        value: vehicles.filter((v) => v.status === "maintenance").length,
        icon: HiOutlineWrenchScrewdriver,
        color: "text-yellow-600 bg-yellow-100",
        darkColor: "dark:text-yellow-400 dark:bg-yellow-900/30",
        state: "maintenance",
      },
      {
        id: "symptoms",
        labelKey: "symptoms",
        value: vehicles.filter((v) => v.status === "alert").length,
        icon: HiOutlineExclamationTriangle,
        color: "text-red-600 bg-red-100",
        darkColor: "dark:text-red-400 dark:bg-red-900/30",
        state: "alert",
      },
      {
        id: "inactive",
        labelKey: "inactive",
        value: vehicles.filter((v) => v.status === "inactive").length,
        icon: HiOutlineNoSymbol,
        color: "text-gray-600 bg-gray-100",
        darkColor: "dark:text-gray-400 dark:bg-gray-700/30",
        state: "inactive",
      },
    ];
  }, [vehicles]);

  const selectedState: VehicleStatus | undefined = useMemo(() => {
    const raw = (searchParams.get("state") ?? "").trim().toLowerCase();
    if (
      raw === "active" ||
      raw === "maintenance" ||
      raw === "alert" ||
      raw === "inactive"
    ) {
      return raw;
    }
    return undefined;
  }, [searchParams]);

  const handleSelectState = useCallback(
    (state: VehicleStatus | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (state) {
        params.set("state", state);
      } else {
        params.delete("state");
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const handleSelectVehicle = useCallback(
    (plate: string) => {
      const qs = searchParams.toString();
      const base = `${pathname}/${encodeURIComponent(plate)}`;
      router.push(qs ? `${base}?${qs}` : base);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-col gap-4 p-4 max-w-screen-2xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {tr("title", fleetDict)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("subtitle", fleetDict)}
        </p>
      </div>

      <KpiCardsRow
        kpis={kpis}
        dict={fleetDict}
        selectedState={selectedState}
        onSelect={handleSelectState}
      />

      <SpecialViewsCarousel views={specialViews} dict={fleetDict} />

      <VehicleGrid
        vehicles={filteredVehicles}
        dict={fleetDict}
        onSelectVehicle={handleSelectVehicle}
        fetchLoading={isLoading}
      />
    </div>
  );
}
