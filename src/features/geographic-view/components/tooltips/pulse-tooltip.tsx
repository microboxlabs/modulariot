import { I18nRecord } from "@/features/i18n/i18n.service.types";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import { pin_conditions } from "@/features/geographic-view/types/pin_conditions";

export type PulseListType = {
  elements: number[];
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
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-light">
            {(dict.symptoms as I18nRecord).pulses_selected as string}:{" "}
            {object.elements.length}
          </span>
        </div>
        <hr className="my-2 border-gray-200 dark:border-gray-700" />
      </div>
    );
  }

  console.log(object);

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
