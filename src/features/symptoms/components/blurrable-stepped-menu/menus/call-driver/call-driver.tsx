import { Textarea } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { useTreatmentsTemplates } from "@/features/common/providers/client-api.provider";

export default function CallDriver({
  dict,
  treatmentData,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
}) {
  const {
    treatments_templates,
    treatments_templates_error,
    treatments_templates_isLoading,
  } = useTreatmentsTemplates(
    treatmentData?.symptom_info?.icu_code.toString() ?? "",
  );

  if (treatments_templates_isLoading) {
    return <div>Loading...</div>;
  }

  if (treatments_templates_error) {
    return <div>Error: {treatments_templates_error.message}</div>;
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
      <div className=" w-full flex flex-col items-center  gap-5 flex-grow">
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {(dict.symptoms as I18nRecord).service_information as string}
          </h1>
          <div className="w-full grid grid-cols-2 gap-2">
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).driver_name as string}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.trip_info.driver}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).vehicle_plate as string}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.trip_info.asset_id}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).phone as string}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {/* treatmentData.phone */}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).service as string}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.symptom_info.name}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).load_type as string}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {/* treatmentData?.symptom_info.type */}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).recommended_prescription as string}
              :{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {(dict.symptoms as I18nRecord).call_driver as string}
              </span>
            </p>
          </div>
        </div>
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {(dict.symptoms as I18nRecord).message_to_communicate as string}
          </h1>
          <Textarea
            placeholder={treatments_templates?.message.replace(
              "[nombre conductor]",
              treatmentData?.trip_info.driver ?? "",
            )}
            className="w-full h-32"
          />
        </div>
      </div>
    </div>
  );
}
