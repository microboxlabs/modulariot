import type { ReactNode } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

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
