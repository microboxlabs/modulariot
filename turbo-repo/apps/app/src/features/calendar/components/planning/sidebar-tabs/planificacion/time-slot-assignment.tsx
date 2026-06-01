"use client";

import {
  TimeSlotAssignment as GenericTimeSlotAssignment,
  type TimeSlotOption,
} from "@microboxlabs/miot-calendar-ui";
export type { TimeSlotOption };

interface TimeSlotAssignmentProps {
  readonly timeOptions: TimeSlotOption[];
  readonly selectedTime: string;
  readonly onTimeChange: (time: string) => void;
}

/**
 * Back-compat shim over the generic package {@link GenericTimeSlotAssignment}.
 * The picker (time + andén availability) now lives in the package, reading its
 * labels from the host i18n seam.
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
