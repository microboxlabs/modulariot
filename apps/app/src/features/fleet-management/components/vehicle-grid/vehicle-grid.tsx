"use client";

import { useState } from "react";
import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import VehicleCard from "./vehicle-card";

interface VehicleGridProps {
  readonly vehicles: Vehicle[];
  readonly dict: I18nRecord;
}

export default function VehicleGrid({ vehicles, dict }: VehicleGridProps) {
  const [isDetailed, setIsDetailed] = useState(true);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {tr("vehicleGrid.title", dict)}
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {tr("vehicleGrid.vehicleCount", dict, {
              count: String(vehicles.length),
            })}
          </span>
        </div>
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            type="button"
            aria-pressed={isDetailed}
            onClick={() => setIsDetailed(true)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              isDetailed
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {tr("vehicleGrid.detailed", dict)}
          </button>
          <button
            type="button"
            aria-pressed={!isDetailed}
            onClick={() => setIsDetailed(false)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              isDetailed
                ? "text-gray-500 dark:text-gray-400"
                : "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
            }`}
          >
            {tr("vehicleGrid.simplified", dict)}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {vehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            dict={dict}
            isDetailed={isDetailed}
          />
        ))}
      </div>
    </div>
  );
}
