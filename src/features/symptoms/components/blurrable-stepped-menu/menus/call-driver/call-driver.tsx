import { Textarea } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";

export default function CallDriver({
  dict,
  treatmentData,
  messageToCommunicate,
  setMessageToCommunicate,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  messageToCommunicate: string;
  setMessageToCommunicate: (message: string) => void;
}) {
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
                {treatmentData?.trip_info?.driver}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).vehicle_plate as string}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.trip_info?.asset_id}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).phone as string}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.trip_info?.driver_contact}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).service as string}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.symptom_info?.name}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {(dict.symptoms as I18nRecord).load_type as string}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.trip_info?.type_load}
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
            /* placeholder={messageToCommunicate} */
            defaultValue={messageToCommunicate}
            className="w-full h-32"
            onChange={(e) => setMessageToCommunicate(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
