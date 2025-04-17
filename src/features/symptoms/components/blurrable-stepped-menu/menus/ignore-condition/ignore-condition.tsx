import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Select } from "flowbite-react";
import { useState } from "react";
import { TiDelete } from "react-icons/ti";

export default function IgnoreCondition({
  dict,
  treatmentData,
  duration,
  setDuration,
  scope,
  setScope,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  duration: number;
  setDuration: (duration: number) => void;
  scope: string;
  setScope: (scope: string) => void;
}) {
  const [durationLocal, setDurationLocal] = useState(duration);
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
      <div className=" w-full flex flex-col items-center  gap-3 flex-grow">
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
                {(dict.symptoms as I18nRecord).ignore_condition as string}
              </span>
            </p>
          </div>
        </div>

        <div className="w-full flex grid grid-cols-2 gap-2 mt-2">
          <div className="pr-2">
            <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
              {(dict.symptoms as I18nRecord).duration as string}
            </h1>

            <Select
              onChange={(e) => {
                setDuration(parseInt(e.target.value));
                setDurationLocal(parseInt(e.target.value));
              }}
              defaultValue={durationLocal}
            >
              <option value="5">
                5 {(dict.symptoms as I18nRecord).minutes as string}
              </option>
              <option value="30">
                30 {(dict.symptoms as I18nRecord).minutes as string}
              </option>
              <option value="60">
                1 {(dict.symptoms as I18nRecord).hour as string}
              </option>
              <option value="240">
                4 {(dict.symptoms as I18nRecord).hours as string}
              </option>
              <option value="-1">
                {(dict.symptoms as I18nRecord).ignore_indefinitely as string}
              </option>
            </Select>
          </div>
          <div className="pl-2 pr-2">
            <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
              {(dict.symptoms as I18nRecord).scope as string}
            </h1>

            <Select
              onChange={(e) => {
                setScope(e.target.value);
              }}
              defaultValue={scope}
              disabled={true}
            >
              <option value="synthom">
                {(dict.symptoms as I18nRecord).this_symptom as string}
              </option>
              <option value="same_synthoms">
                {(dict.symptoms as I18nRecord).same_symptoms as string}
              </option>
              <option value="all_synthoms">
                {(dict.symptoms as I18nRecord).all_symptoms as string}
              </option>
            </Select>
          </div>
          {/* <div>
            <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
              {(dict.symptoms as I18nRecord).ignore_indefinitely as string}
            </h1>

            <Checkbox
              id="ignore-indefinitely"
              defaultChecked={ignoreIndefinitelyLocal}
              onChange={handleCheckboxChange}
              className="h-4 w-4"
            />
          </div> */}
        </div>
        <div className="w-full flex flex-col gap-2 bg-orange-50 p-3 rounded-lg">
          <div className="flex flex-row items-center gap-2 text-orange-800">
            <TiDelete size={25} />
            {(dict.symptoms as I18nRecord).confirmation_required as string}
          </div>
          <p className="text-sm font-light text-orange-800 dark:text-orange-800">
            {(dict.symptoms as I18nRecord).ignore_alert as string}
          </p>
        </div>
      </div>
    </div>
  );
}
