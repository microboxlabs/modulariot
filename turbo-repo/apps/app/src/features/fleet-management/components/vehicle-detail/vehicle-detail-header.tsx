"use client";

import {
  HiOutlineTruck,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiArrowLeft,
} from "react-icons/hi2";
import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import VehicleStatusBadge from "../vehicle-grid/vehicle-status-badge";

interface VehicleDetailHeaderProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
  readonly hasPrevious?: boolean;
  readonly hasNext?: boolean;
  readonly onBack: () => void;
}

export default function VehicleDetailHeader({
  vehicle,
  dict,
  onPrevious,
  onNext,
  hasPrevious = true,
  hasNext = true,
  onBack,
}: VehicleDetailHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-end justify-between gap-4">
        {/* Left: Vehicle info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            type="button"
            className="p-2 aspect-square rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex justify-center items-center"
            aria-label={tr("vehicleDetail.back", dict)}
            onClick={onBack}
          >
            <HiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          {/* Truck icon */}
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
            <HiOutlineTruck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>

          {/* Details row */}
          <div className="flex items-center gap-6 flex-1 min-w-0 overflow-x-auto">
            {/* Plate */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.plate", dict)}
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {vehicle.plate}
              </span>
            </div>

            {/* Model + Brand */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.model", dict)}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {vehicle.brand} {vehicle.model}
              </span>
            </div>

            {/* Status */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.status", dict)}
              </span>
              <VehicleStatusBadge status={vehicle.status} dict={dict} />
            </div>

            {/* Client */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.transportist", dict)}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {vehicle.transportist}
              </span>
            </div>

            {/* Km totales */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.kmTraveled", dict)}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {vehicle.kmTraveled.toLocaleString()} km
              </span>
            </div>

            {/* Last signal */}
            {vehicle.lastSignal && (
              <div className="flex flex-col shrink-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {tr("vehicleGrid.lastSignal", dict)}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {vehicle.lastSignal}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Navigation buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onPrevious}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={tr("fleetManagement.previous", dict)}
          >
            <HiOutlineChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={tr("fleetManagement.next", dict)}
          >
            <HiOutlineChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
