"use client";

import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  HealthSection,
  MaintenanceSection,
  TechnicalHealthSection,
  TelemetrySection,
  EventsSection,
  UsageSection,
  GeneralInfoSection,
} from "./sections";

interface VehicleDetailAccordionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
}

export default function VehicleDetailAccordion({
  vehicle,
  dict,
}: VehicleDetailAccordionProps) {
  const gamification = vehicle.gamification;
  const healthScore = gamification?.healthScore ?? 75;

  return (
    <div className="flex flex-col gap-3">
      <HealthSection vehicle={vehicle} dict={dict} healthScore={healthScore} />
      <MaintenanceSection vehicle={vehicle} dict={dict} />
      <TechnicalHealthSection dict={dict} />
      <TelemetrySection dict={dict} />
      <EventsSection dict={dict} />
      <UsageSection vehicle={vehicle} dict={dict} gamification={gamification} />
      <GeneralInfoSection vehicle={vehicle} dict={dict} />
    </div>
  );
}
