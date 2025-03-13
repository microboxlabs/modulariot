import { Textarea } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function DriverResponse({
  dict,
  driverResponse,
  setDriverResponse,
}: {
  dict: I18nRecord;
  driverResponse: string;
  setDriverResponse: (driverResponse: string) => void;
}) {
  return (
    <div className="h-full w-full flex flex-col items-center gap-2">
      <div className=" w-full flex flex-col items-center gap-5 flex-grow">
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {(dict.symptoms as I18nRecord).driver_response as string}
          </h1>
          <Textarea
            placeholder={
              (dict.symptoms as I18nRecord).message_to_the_driver as string
            }
            className="w-full h-32 text-gray-900 dark:text-white"
            defaultValue={driverResponse}
            onChange={(e) => setDriverResponse(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
