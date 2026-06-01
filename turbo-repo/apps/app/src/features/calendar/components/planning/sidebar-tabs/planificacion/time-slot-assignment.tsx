"use client";

import {
  TimeSlotAssignment as GenericTimeSlotAssignment,
  type TimeSlotOption,
} from "@microboxlabs/miot-calendar-ui";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

export type { TimeSlotOption };

interface ServiceCategoryOption {
  value: string;
  label: string;
}

interface TimeSlotAssignmentProps {
  readonly dict: I18nRecord;
  readonly timeOptions: TimeSlotOption[];
  readonly selectedTime: string;
  readonly onTimeChange: (time: string) => void;
  readonly serviceCategoryOptions: ServiceCategoryOption[];
  readonly selectedServiceCategory: string;
  readonly onServiceCategoryChange: (category: string) => void;
  readonly isLoadingServiceTypes: boolean;
}

/**
 * Back-compat shim over the generic package {@link GenericTimeSlotAssignment}.
 * The picker (time + andén availability) now lives in the package, reading its
 * labels from the host i18n seam; the service-category props are retained for
 * the historical call site but are no longer used here.
 */
export function TimeSlotAssignment({
  timeOptions,
  selectedTime,
  onTimeChange,
}: TimeSlotAssignmentProps) {
  return (
    <GenericTimeSlotAssignment
      timeOptions={timeOptions}
      selectedTime={selectedTime}
      onTimeChange={onTimeChange}
    />
  );
}
