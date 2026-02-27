"use client";

import {
  HiOutlineFire,
  HiOutlineWrenchScrewdriver,
  HiOutlineMapPin,
} from "react-icons/hi2";
import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import VehicleStatusBadge from "./vehicle-status-badge";
import VehicleStatItem from "./vehicle-stat-item";

interface VehicleCardProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
  readonly isDetailed: boolean;
}

export default function VehicleCard({
  vehicle,
  dict,
  isDetailed,
}: VehicleCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {vehicle.plate}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {vehicle.model}
          </span>
        </div>
        <VehicleStatusBadge status={vehicle.status} dict={dict} />
      </div>

      {isDetailed && (
        <>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.driver", dict)}:
              </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {vehicle.driver}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <HiOutlineMapPin className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.location", dict)}:
              </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium truncate">
                {vehicle.lastLocation}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center gap-4 flex-wrap">
            <VehicleStatItem
              icon={HiOutlineFire}
              label={tr("vehicleGrid.fuel", dict)}
              value={`${vehicle.fuelLevel}%`}
            />
            <VehicleStatItem
              icon={HiOutlineWrenchScrewdriver}
              label={tr("vehicleGrid.maintenance", dict)}
              value={vehicle.nextMaintenance}
            />
            <VehicleStatItem
              icon={HiOutlineMapPin}
              label={tr("vehicleGrid.kmTraveled", dict)}
              value={vehicle.kmTraveled.toLocaleString()}
            />
          </div>
        </>
      )}
    </div>
  );
}
