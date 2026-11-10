import type { ReactNode } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { tripPlateNow } from "@/features/symptoms/model/plate-change";

/** A header chip: a placeholder while loading, then the value or a dash. */
export function chipText(
  loading: boolean,
  value: string | null | undefined,
  label?: string
): ReactNode {
  if (loading) {
    return (
      <div className="bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md">
        ejemplo
      </div>
    );
  }
  const text = value || "—";
  return label ? `${label}: ${text}` : text;
}

/** The plate chip, followed by the trip's current plate when the truck was replaced. */
export function plateChip(
  plate: ReactNode,
  tripPlate: string | null,
  dict: I18nRecord
): ReactNode {
  if (!tripPlate) return plate;
  return (
    <>
      {plate}
      <span className="ml-1 text-amber-700 dark:text-amber-400">
        · {tr("symptoms.trip_plate_now", dict, { plate: tripPlate })}
      </span>
    </>
  );
}

/** Keep the styled plate and its layout measurement in sync, including both plates. */
export function plateTag(
  loading: boolean,
  casePlate: string | null | undefined,
  tripPlate: string | null | undefined,
  dict: I18nRecord
) {
  const plate = chipText(
    loading,
    casePlate,
    (dict.symptoms as I18nRecord).license_plate as string
  );
  const current = loading ? null : tripPlateNow(casePlate, tripPlate);
  let measurementText = typeof plate === "string" ? plate : undefined;
  if (current) {
    measurementText = `${measurementText} · ${tr("symptoms.trip_plate_now", dict, { plate: current })}`;
  }
  return { text: plateChip(plate, current, dict), measurementText };
}
