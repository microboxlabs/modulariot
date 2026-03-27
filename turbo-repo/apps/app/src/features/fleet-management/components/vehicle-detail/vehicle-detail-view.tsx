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
    <div className="flex flex-col gap-3">
      <VehicleDetailHeader vehicle={vehicle} dict={dict} onBack={onBack} />
      <VehicleDetailAccordion vehicle={vehicle} dict={dict} />
    </div>
  );
}
