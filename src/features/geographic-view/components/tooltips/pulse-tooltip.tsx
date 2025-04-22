import { I18nRecord } from "@/features/i18n/i18n.service.types";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import { pin_conditions } from "@/features/geographic-view/types/pin_conditions";
import { DescriptionProps } from "@/app/api/treatments/location/route.type";
export type PulseListType = {
  elements: number[];
  description: DescriptionProps;
};

export type PulseType = {
  properties: {
    icu_code: number; // 1, 2, 3, 4
    asset_id: string;
    rotation: number;
    latitude: number;
    longitude: number;
    speed: number;
    timestamp: string;
  };
};

export default function PulseTooltip({
  object,
  dict,
}: {
  object: PulseType | PulseListType | undefined;
  dict: I18nRecord;
}) {
  if (!object) {
    return null;
  }

  if ("elements" in object && object.elements.length === 0) {
    return null;
  }

  if ("elements" in object) {
    return (
      <div className="bg-white dark:bg-gray-800 px-3 pb-3 rounded-lg">
        {object.description.symptom_name != undefined && (
          <div className="text-m text-gray-600 dark:text-gray-300 font-light">
            {
              (dict.symptoms as I18nRecord)[
                object.description.symptom_name.toUpperCase() as keyof typeof dict.symptoms
              ] as string
            }
          </div>
        )}
        {object.description.zone_names != undefined && (
          <div className="text-sm font-light text-gray-500 dark:text-gray-400">
            {object.description.zone_names}
          </div>
        )}
        {(object.description.first_signal_timestamp ||
          object.description.last_signal_timestamp ||
          object.description.signal_lag ||
          object.description.accumulated_drive_time ||
          object.description.accumulated_detention_time ||
          object.description.accumulated_resting_time) && (
          <hr className="my-2 border-gray-200 dark:border-gray-700" />
        )}
        {object.description.first_signal_timestamp != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {
              (dict.geographic_view as I18nRecord)
                .first_signal_timestamp as string
            }
            :{" "}
            <span className="font-light">
              {new Date(
                object.description.first_signal_timestamp,
              ).toLocaleString()}
            </span>
          </div>
        )}
        {object.description.last_signal_timestamp != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {
              (dict.geographic_view as I18nRecord)
                .last_signal_timestamp as string
            }
            :{" "}
            <span className="font-light">
              {new Date(
                object.description.last_signal_timestamp,
              ).toLocaleString()}
            </span>
          </div>
        )}
        {object.description.signal_lag != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {(dict.geographic_view as I18nRecord).signal_lag as string}:{" "}
            <span className="font-light">
              {object.description.signal_lag} km/h
            </span>
          </div>
        )}
        {object.description.accumulated_drive_time != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {
              (dict.geographic_view as I18nRecord)
                .accumulated_drive_time as string
            }
            :{" "}
            <span className="font-light">
              {object.description.accumulated_drive_time} km/h
            </span>
          </div>
        )}
        {object.description.accumulated_detention_time != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {
              (dict.geographic_view as I18nRecord)
                .accumulated_detention_time as string
            }
            :{" "}
            <span className="font-light">
              {object.description.accumulated_detention_time} km/h
            </span>
          </div>
        )}
        {object.description.accumulated_resting_time != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {
              (dict.geographic_view as I18nRecord)
                .accumulated_resting_time as string
            }
            :{" "}
            <span className="font-light">
              {object.description.accumulated_resting_time} km/h
            </span>
          </div>
        )}
        {(object.description.speed_limit ||
          object.description.speed ||
          object.description.signal_lag ||
          object.description.last_reported_speed ||
          object.description.last_reported_engine_status) && (
          <hr className="my-2 border-gray-200 dark:border-gray-700" />
        )}
        {object.description.speed != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {(dict.geographic_view as I18nRecord).speed as string}:{" "}
            <span className="font-light">{object.description.speed} km/h</span>
            {object.description.speed_limit &&
              object.description.speed > object.description.speed_limit && (
                <span className="text-red-500 dark:text-red-400">
                  {" - "}
                  {object.description.speed - object.description.speed_limit}
                  km/h{" "}
                  {(dict.geographic_view as I18nRecord).over_limit as string}
                </span>
              )}
          </div>
        )}
        {object.description.speed_limit != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {(dict.geographic_view as I18nRecord).speed_limit as string}:{" "}
            <span className="font-light">
              {object.description.speed_limit} km/h
            </span>
          </div>
        )}
        {object.description.last_reported_speed != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {(dict.geographic_view as I18nRecord).last_reported_speed as string}
            :{" "}
            <span className="font-light text-gray-600 dark:text-gray-300">
              {object.description.last_reported_speed} km/h
            </span>
          </div>
        )}
        {object.description.last_reported_engine_status != undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {
              (dict.geographic_view as I18nRecord)
                .last_reported_engine_status as string
            }
            :{" "}
            <span className="font-light">
              {object.description.last_reported_engine_status ? (
                <span className="text-green-500 dark:text-green-400">
                  {(dict.geographic_view as I18nRecord).on as string}
                </span>
              ) : (
                <span className="text-red-500 dark:text-red-400">
                  {(dict.geographic_view as I18nRecord).off as string}
                </span>
              )}
            </span>
          </div>
        )}
        <hr className="my-2 border-gray-200 dark:border-gray-700" />
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-light">
            {(dict.symptoms as I18nRecord).pulses_selected as string}:{" "}
            {object.elements.length}
          </span>
        </div>
      </div>
    );
  }

  if ("asset_id" in object.properties) {
    return (
      <div className="bg-white dark:bg-gray-800 px-3 pb-3 rounded-lg">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {(dict.symptoms as I18nRecord).license_plate as string}:{" "}
          {object?.properties.asset_id}
        </div>
        <hr className="my-2 border-gray-200 dark:border-gray-700" />
        {object?.properties.icu_code &&
        object?.properties.icu_code != 0 &&
        pin_conditions[
          object?.properties.icu_code as unknown as keyof typeof pin_conditions
        ] != undefined ? (
          <div>
            <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
              <ConditionIcon
                condition={
                  pin_conditions[
                    object?.properties
                      .icu_code as unknown as keyof typeof pin_conditions
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
                        .icu_code as unknown as keyof typeof pin_conditions
                    ].label as string
                  ] as string
                }
              </div>
            </div>
            {/*
            
            <div className="flex flex-wrap gap-2 pt-1 text-red-500 dark:text-red-400">
              {object?.properties.associate_symptoms.map((symptom: Symptom) => (
                <div key={symptom.symptom_id} className="text-sm indent-2">
                  {symptom.symptom_name}
                </div>
              ))}
            </div>

            */}
            <hr className="my-2 border-gray-200 dark:border-gray-700" />
          </div>
        ) : null}
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {(dict.geographic_view as I18nRecord).date_and_time as string}:{" "}
          {object?.properties.timestamp
            ? new Date(object?.properties.timestamp).toLocaleString()
            : ""}
        </div>
        <hr className="my-2 border-gray-200 dark:border-gray-700" />
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {(dict.geographic_view as I18nRecord).speed as string}:{" "}
          <span className="font-light">{object?.properties.speed} km/h</span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {(dict.geographic_view as I18nRecord).latitude as string}:{" "}
          <span className="font-light">{object?.properties.latitude}</span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {(dict.geographic_view as I18nRecord).longitude as string}:{" "}
          <span className="font-light">{object?.properties.longitude}</span>
        </div>
        <hr className="my-2 border-gray-200 dark:border-gray-700" />
      </div>
    );
  }

  return null;
}
