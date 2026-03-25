"use client";

import { HiArrowLeft } from "react-icons/hi2";
import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import VehicleDetailHeader from "./vehicle-detail-header";
import VehicleDetailAccordion from "./vehicle-detail-accordion";

interface VehicleDetailViewProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
  readonly onBack: () => void;
}

export default function VehicleDetailView({
  vehicle,
  dict,
  onBack,
}: VehicleDetailViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          aria-label={tr("vehicleDetail.back", dict)}
        >
          <HiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {tr("vehicleDetail.title", dict)}
        </h1>
      </div>

      <VehicleDetailHeader vehicle={vehicle} dict={dict} />

      <VehicleDetailAccordion vehicle={vehicle} dict={dict} />
    </div>
  );
}
