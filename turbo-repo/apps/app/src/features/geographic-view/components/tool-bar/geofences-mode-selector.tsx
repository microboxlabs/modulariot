import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/**
 * Qué geocercas muestra el mapa de viaje: todas (las del viaje y las de
 * Lugares), solo las del viaje, o ninguna.
 */
export type GeofencesMode = "all" | "trip" | "none";

export const GEOFENCES_MODES: GeofencesMode[] = ["all", "trip", "none"];

export default function GeofencesModeSelector({
  mode,
  setMode,
  dictionary,
}: Readonly<{
  mode: GeofencesMode;
  setMode: (mode: GeofencesMode) => void;
  dictionary: I18nRecord;
}>) {
  return (
    <div
      role="radiogroup"
      aria-label={tr("symptoms.geofences", dictionary)}
      className="flex flex-col gap-1"
    >
      {GEOFENCES_MODES.map((opcion) => (
        <button
          key={opcion}
          type="button"
          role="radio"
          aria-checked={mode === opcion}
          onClick={() => setMode(opcion)}
          className={twMerge(
            "cursor-pointer rounded-md px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors",
            mode === opcion
              ? "bg-blue-500 text-white"
              : "bg-gray-50 text-gray-700 hover:bg-gray-200"
          )}
        >
          {tr(`symptoms.geofencesMode.${opcion}`, dictionary)}
        </button>
      ))}
    </div>
  );
}
