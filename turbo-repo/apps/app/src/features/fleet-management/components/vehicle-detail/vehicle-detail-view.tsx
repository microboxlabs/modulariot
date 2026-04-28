"use client";

import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import VehicleDetailHeader from "./vehicle-detail-header";
import VehicleDetailAccordion from "./vehicle-detail-accordion";

interface VehicleDetailViewProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
  readonly onBack: () => void;
  readonly previous?: { hasPrevious: boolean; onPrevious: () => void };
  readonly next?: { hasNext: boolean; onNext: () => void };
}

export default function VehicleDetailView({
  vehicle,
  dict,
  onBack,
  previous,
  next,
}: VehicleDetailViewProps) {
  return (
    <div className="flex flex-col h-full items-center w-full">
      <VehicleDetailHeader
        vehicle={vehicle}
        dict={dict}
        onBack={onBack}
        onPrevious={previous?.onPrevious}
        onNext={next?.onNext}
        hasPrevious={previous?.hasPrevious ?? false}
        hasNext={next?.hasNext ?? false}
      />
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto w-full items-center bg-gray-50 dark:bg-gray-900 px-4 xl:px-0">
        <VehicleDetailAccordion vehicle={vehicle} dict={dict} />
      </div>
    </div>
  );
}
