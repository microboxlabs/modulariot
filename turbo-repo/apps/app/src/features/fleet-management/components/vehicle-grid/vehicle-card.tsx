"use client";

import {
  HiOutlineFire,
  HiOutlineMapPin,
  HiOutlineUser,
  HiOutlineTruck,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
} from "react-icons/hi2";
import { IoSpeedometerOutline } from "react-icons/io5";
import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import VehicleStatusBadge from "./vehicle-status-badge";
import VehicleStatItem from "./vehicle-stat-item";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";

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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-3 cursor-pointer transition-colors hover:border-blue-500 dark:hover:border-blue-400">
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
          <div className="flex flex-col gap-1.5">
            <LoadableLabel
              label={tr("vehicleGrid.driver", dict)}
              value={vehicle.driver}
              icon={<HiOutlineUser className="w-5 h-5" />}
              className="text-sm"
            />
            <LoadableLabel
              label={tr("vehicleGrid.location", dict)}
              value={vehicle.lastLocation}
              icon={<HiOutlineMapPin className="w-5 h-5" />}
              className="text-sm"
            />
            <LoadableLabel
              label={tr("vehicleGrid.brand", dict)}
              value={vehicle.brand}
              icon={<HiOutlineTruck className="w-5 h-5" />}
              className="text-sm"
            />
            <LoadableLabel
              label={tr("vehicleGrid.transportist", dict)}
              value={vehicle.transportist}
              icon={<HiOutlineBuildingOffice2 className="w-5 h-5" />}
              className="text-sm"
            />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between gap-2">
            <VehicleStatItem
              icon={HiOutlineFire}
              label={tr("vehicleGrid.fuel", dict)}
              value={`${vehicle.fuelLevel}%`}
            />
            <VehicleStatItem
              icon={HiOutlineCalendarDays}
              label={tr("vehicleGrid.maintenance", dict)}
              value={vehicle.nextMaintenance}
            />
            <VehicleStatItem
              icon={IoSpeedometerOutline}
              label={tr("vehicleGrid.kmTraveled", dict)}
              value={vehicle.kmTraveled.toLocaleString()}
            />
          </div>
        </>
      )}
    </div>
  );
}
