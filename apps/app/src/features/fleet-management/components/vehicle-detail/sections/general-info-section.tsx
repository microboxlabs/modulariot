"use client";

import { HiOutlineInformationCircle } from "react-icons/hi2";
import type { Vehicle } from "../../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { InfoRow } from "@/features/common/components/info-row";

interface GeneralInfoSectionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
}

export default function GeneralInfoSection({
  vehicle,
  dict,
}: GeneralInfoSectionProps) {
  return (
    <ExpandableSection
      icon={HiOutlineInformationCircle}
      title={tr("vehicleDetail.sections.general.title", dict)}
      description={tr("vehicleDetail.sections.general.description", dict)}
    >
      <div className="flex flex-col gap-3 pt-4">
        <InfoRow
          label={tr("vehicleDetail.sections.general.plate", dict)}
          value={vehicle.plate}
        />
        <InfoRow
          label={tr("vehicleDetail.sections.general.model", dict)}
          value={vehicle.model}
        />
        <InfoRow
          label={tr("vehicleDetail.sections.general.type", dict)}
          value={vehicle.type}
        />
        <InfoRow
          label={tr("vehicleDetail.sections.general.brand", dict)}
          value={vehicle.brand}
        />
        <InfoRow
          label={tr("vehicleDetail.sections.general.carrier", dict)}
          value={vehicle.transportist}
        />
        <InfoRow
          label={tr("vehicleDetail.sections.general.driver", dict)}
          value={vehicle.driver}
        />
        <InfoRow
          label={tr("vehicleDetail.sections.general.location", dict)}
          value={vehicle.lastLocation}
        />
      </div>
    </ExpandableSection>
  );
}
