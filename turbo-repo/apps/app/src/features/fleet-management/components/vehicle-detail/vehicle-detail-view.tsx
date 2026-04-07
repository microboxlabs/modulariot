"use client";

import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
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
    <div className="flex flex-col h-full items-center w-full">
      <VehicleDetailHeader vehicle={vehicle} dict={dict} onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-y-auto w-[70vw] max-w-screen-2xl">
        <VehicleDetailAccordion vehicle={vehicle} dict={dict} />
      </div>
    </div>
  );
}
