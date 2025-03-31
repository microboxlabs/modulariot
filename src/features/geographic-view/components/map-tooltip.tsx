import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { MapPositionProperties, Symptom } from "../types/map";
import ConditionIcon from "../../symptoms/components/condition-icon";
import { pin_conditions } from "../types/pin_conditions";

type MapTooltipProps = {
  dict: I18nRecord;
  object: MapPositionProperties | undefined;
  left: number;
  top: number;
};

export default function MapTooltip({
  dict,
  object,
  left,
  top,
}: MapTooltipProps) {
  if (!object) {
    return null;
  }

  if (object.properties.cluster) {
    return null;
  }

  return (
    <div
      className="absolute z-10 bg-transparent border-none m-0 p-0"
      style={{ left, top }}
    >
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {(dict.symptoms as I18nRecord).license_plate as string}:{" "}
          {object?.properties.asset_id}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {(dict.geographic_view as I18nRecord).trip as string}:{" "}
          {object?.properties.trip_id}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {(dict.geographic_view as I18nRecord).date_and_time as string}:{" "}
          {object?.properties.timestamp
            ? new Date(object?.properties.timestamp).toLocaleString()
            : ""}
        </div>
        <hr className="my-2 border-gray-200 dark:border-gray-700" />
        {object?.properties.lost_signal && (
          <div>
            <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg font-light text-sm">
              <span className="text-gray-600 dark:text-gray-300 font-normal">
                {(dict.geographic_view as I18nRecord).signal_status as string}:
              </span>{" "}
              <span className="font-light text-red-500 dark:text-red-400">
                {(dict.geographic_view as I18nRecord).lost_signal as string}
              </span>
            </div>
            <hr className="my-2 border-gray-200 dark:border-gray-700" />
          </div>
        )}

        {/* Conditions and symptoms */}
        {object?.properties.symptoms_condition && (
          <div>
            <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
              <ConditionIcon
                condition={
                  pin_conditions[
                    object?.properties
                      .symptoms_condition as unknown as keyof typeof pin_conditions
                  ].icon
                }
                dict={dict}
                size="w-6 h-6"
              />
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {
                  (dict.symptoms as I18nRecord)[
                    pin_conditions[
                      object?.properties
                        .symptoms_condition as unknown as keyof typeof pin_conditions
                    ].label as string
                  ] as string
                }
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 text-red-500 dark:text-red-400">
              {object?.properties.associate_symptoms.map((symptom: Symptom) => (
                <div key={symptom.symptom_id} className="text-sm indent-2">
                  {symptom.symptom_name}
                </div>
              ))}
            </div>
            <hr className="my-2 border-gray-200 dark:border-gray-700" />
          </div>
        )}
        {/* Speed */}
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {(dict.geographic_view as I18nRecord).speed as string}:{" "}
          <span
            className={`font-bold ${object?.properties.speed_limit && object?.properties.speed > object?.properties.speed_limit ? "text-red-500 dark:text-red-400" : "text-green-500 dark:text-green-400"}`}
          >
            {object?.properties.speed} <span className="font-light">km/h</span>
          </span>
          {object?.properties.speed_limit &&
          object?.properties.speed > object?.properties.speed_limit ? (
            <span className="text-red-500 dark:text-red-400">
              {" - "}
              {object?.properties.speed -
                object?.properties.speed_limit}km/h{" "}
              {(dict.geographic_view as I18nRecord).over_limit as string}
            </span>
          ) : (
            ""
          )}
        </div>
        {object?.properties.speed_limit && (
          <div
            className={`text-sm text-gray-600 dark:text-gray-300 ${object?.properties.speed_limit ? "block" : "hidden"}`}
          >
            {(dict.geographic_view as I18nRecord).speed_limit as string}:{" "}
            <span className="text-green-500 dark:text-green-400">
              {object?.properties.speed_limit}Km/h
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
