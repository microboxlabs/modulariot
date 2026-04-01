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
  readonly onSelect?: (plate: string) => void;
}

export default function VehicleCard({
  vehicle,
  dict,
  isDetailed,
  onSelect,
}: VehicleCardProps) {
  const handleClick = () => {
    onSelect?.(vehicle.plate);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(vehicle.plate);
    }
  };

  const isInteractive = Boolean(onSelect);
  const baseClasses = "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-3 transition-colors";
  const interactiveClasses = "cursor-pointer hover:border-gray-400 dark:hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400";

  const cardContent = (
    <>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {vehicle.plate}
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
              label={tr("vehicleGrid.model", dict)}
              value={vehicle.model}
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
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`${baseClasses} ${interactiveClasses}`}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div className={baseClasses}>
      {cardContent}
    </div>
  );
}
