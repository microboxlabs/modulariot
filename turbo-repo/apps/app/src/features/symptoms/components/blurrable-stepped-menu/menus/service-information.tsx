import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";

export default function ServiceInformation({
  dict,
  treatmentData,
  prescriptionKey,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  prescriptionKey: string;
}>) {
  return (
    <div className="w-full flex flex-col gap-2">
      <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
        {tr("symptoms.service_information", dict)}
      </h1>
      <div className="w-full grid grid-cols-2 gap-2">
        <p className="text-xs font-light text-gray-900 dark:text-gray-200">
          {tr("symptoms.driver_name", dict)}:{" "}
          <span className="font-light text-gray-500 dark:text-gray-400">
            {treatmentData?.trip_info?.driver}
          </span>
        </p>
        <p className="text-xs font-light text-gray-900 dark:text-gray-200">
          {tr("symptoms.vehicle_plate", dict)}:{" "}
          <span className="font-light text-gray-500 dark:text-gray-400">
            {treatmentData?.trip_info?.asset_id}
          </span>
        </p>
        <p className="text-xs font-light text-gray-900 dark:text-gray-200">
          {tr("symptoms.phone", dict)}:{" "}
          <span className="font-light text-gray-500 dark:text-gray-400">
            {treatmentData?.trip_info?.driver_contact}
          </span>
        </p>
        <p className="text-xs font-light text-gray-900 dark:text-gray-200">
          {tr("symptoms.service", dict)}:{" "}
          <span className="font-light text-gray-500 dark:text-gray-400">
            {treatmentData?.symptom_info?.name}
          </span>
        </p>
        <p className="text-xs font-light text-gray-900 dark:text-gray-200">
          {tr("symptoms.load_type", dict)}:{" "}
          <span className="font-light text-gray-500 dark:text-gray-400">
            {treatmentData?.trip_info?.type_load}
          </span>
        </p>
        <p className="text-xs font-light text-gray-900 dark:text-gray-200">
          {tr("symptoms.recommended_prescription", dict)}:{" "}
          <span className="font-light text-gray-500 dark:text-gray-400">
            {trDynamic(prescriptionKey, dict)}
          </span>
        </p>
      </div>
    </div>
  );
}
