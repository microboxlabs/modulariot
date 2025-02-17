import { Textarea } from "flowbite-react";

export default function CallDriver({ dict }: { dict: any }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
      <div className=" w-full flex flex-col items-center  gap-5 flex-grow">
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {dict.symptoms.service_information}
          </h1>
          <div className="w-full grid grid-cols-2 gap-2">
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {dict.symptoms.driver_name}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">Anonimo Andres</span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {dict.symptoms.vehicle_plate}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">XX BB 21</span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {dict.symptoms.phone}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">+56 9 8241 9297</span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {dict.symptoms.service}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">V-1406865</span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {dict.symptoms.load_type}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">Rampla Sider</span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {dict.symptoms.recommended_prescription}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {dict.symptoms.call_driver}
              </span>
            </p>
          </div>
        </div>
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {dict.symptoms.message_to_communicate}
          </h1>
          <Textarea
            placeholder={dict.symptoms.message_to_the_driver}
            className="w-full h-32"
          />
        </div>
      </div>
    </div>
  );
}
