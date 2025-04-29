import { I18nRecord } from "@/features/i18n/i18n.service.types";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import { pin_conditions } from "@/features/geographic-view/types/pin_conditions";
import {
  MapPositionProperties,
  Symptom,
} from "@/features/geographic-view/types/map";

export default function PinTooltip({
  object,
  dict,
}: {
  object: MapPositionProperties | undefined;
  dict: I18nRecord;
}) {
  if (!object) {
    return null;
  }

  if (object.properties.cluster) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 px-3 pb-3 rounded-lg">
      {object?.properties.cluster && (
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {(dict.symptoms as I18nRecord).cluster as string}:{" "}
          {object?.properties.cluster}
        </div>
      )}

      <div className="text-sm font-medium text-gray-900 dark:text-white">
        {(dict.symptoms as I18nRecord).license_plate as string}:{" "}
        {object?.properties.asset_id}
      </div>
      {object?.properties.trip_id && (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {(dict.geographic_view as I18nRecord).trip as string}:{" "}
          {object?.properties.trip_id}
        </div>
      )}
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
                ].label
              ] as string
            }
          </div>
        </div>
        {object?.properties.associate_symptoms && (
          <div className="flex flex-wrap flex-col pt-1 text-red-500 dark:text-red-400">
            {object?.properties.associate_symptoms.map((symptom: Symptom) => (
              <div key={symptom.symptom_id} className="text-sm indent-2">
                - {symptom.symptom_name}
              </div>
            ))}
          </div>
        )}
        <hr className="my-2 border-gray-200 dark:border-gray-700" />
      </div>
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
            {object?.properties.speed - object?.properties.speed_limit}km/h{" "}
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
      {object?.properties.gps_provider && (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {(dict.geographic_view as I18nRecord).gps_provider as string}:{" "}
          <span className="text-green-500 dark:text-green-400">
            {object?.properties.gps_provider
              .replace(/_/g, " ")
              .replace(/-/g, " ")}
          </span>
        </div>
      )}
    </div>
  );
}
