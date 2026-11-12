import Image, { type StaticImageData } from "next/image";
import blue_pin from "@assets/pin/blue_pin.svg";
import black_code from "@assets/icons/map/conditions_separated/codigo_negro.svg";
import compromised_code from "@assets/icons/map/conditions_separated/comprometida.svg";
import critical_code from "@assets/icons/map/conditions_separated/critica.svg";
import observation_code from "@assets/icons/map/conditions_separated/observacion.svg";
import treatment_code from "@assets/icons/map/conditions_separated/tratamiento.svg";
import stable_code from "@assets/icons/map/conditions_separated/estable.svg";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type {
  ConstellationCondition,
  SymptomConstellationCounts,
} from "../types/symptoms";
import ConstellationCount from "./constellation-count";
import "./style/orbitation.css";

/** Each orbiting icon, its condition and the `symptoms.*` key naming it. */
const ORBITS: {
  condition: ConstellationCondition;
  icon: StaticImageData;
  label: string;
}[] = [
  { condition: "codeBlack", icon: black_code, label: "code_black" },
  {
    condition: "compromised",
    icon: compromised_code,
    label: "compromised_condition",
  },
  { condition: "critic", icon: critical_code, label: "critical_condition" },
  { condition: "observation", icon: observation_code, label: "in_observation" },
  { condition: "treatment", icon: treatment_code, label: "in_treatment" },
  { condition: "stable", icon: stable_code, label: "stable" },
];

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function conditionLabel(
  labelKey: string,
  count: number,
  dict: I18nRecord
): string {
  return trDynamic("symptoms.constellation_condition_count", dict, {
    condition: capitalized(trDynamic(`symptoms.${labelKey}`, dict)),
    count: String(count),
  });
}

/**
 * The condition rings with their icons orbiting the pin. With `counts` and
 * `dict`, each icon carries its open cases and the pin the vehicles on a trip.
 */
export default function EmptyAnimation({
  counts,
  dict,
}: Readonly<{ counts?: SymptomConstellationCounts; dict?: I18nRecord }>) {
  const shown = counts && dict ? { counts, dict } : null;

  return (
    <div className="relative flex flex-col justify-center items-center">
      <div className="border-2 border-gray-300 dark:border-gray-600 rounded-full h-[320px] w-[320px] flex justify-center items-center">
        <div className="border-2 border-gray-300 dark:border-gray-600 rounded-full h-[230px] w-[230px] flex justify-center items-center">
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-full h-[150px] w-[150px] flex justify-center items-center">
            <div className="absolute h-20 w-20 bg-gray-100 dark:bg-gray-700 rounded-full flex justify-center items-center">
              <Image
                src={blue_pin}
                alt="Orbitation"
                width={1000}
                height={1000}
                unoptimized
                className="h-16 w-16"
              />
              {shown && (
                <ConstellationCount
                  tone="onTrip"
                  value={shown.counts.vehiclesOnTrip}
                  label={trDynamic(
                    "symptoms.constellation_on_trip",
                    shown.dict,
                    {
                      count: String(shown.counts.vehiclesOnTrip),
                    }
                  )}
                  className="top-auto right-auto bottom-1 left-1 h-6 min-w-6 text-xs"
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {ORBITS.map((orbit, index) => (
        <div
          key={orbit.condition}
          className={`h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-${index + 1} rounded-full`}
        >
          <Image
            src={orbit.icon}
            alt="Orbitation"
            width={1000}
            height={1000}
            className="h-16 w-16"
          />
          {shown && (
            <ConstellationCount
              tone={orbit.condition}
              value={shown.counts.conditions[orbit.condition]}
              label={conditionLabel(
                orbit.label,
                shown.counts.conditions[orbit.condition],
                shown.dict
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
