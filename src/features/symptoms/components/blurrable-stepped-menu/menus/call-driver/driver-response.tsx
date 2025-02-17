import { Textarea } from "flowbite-react";

export default function DriverResponse({ dict }: { dict: any }) {
  return (
    <div className="h-full w-full flex flex-col items-center gap-2">
      <div className=" w-full flex flex-col items-center gap-5 flex-grow">
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {dict.symptoms.driver_response}
          </h1>
          <Textarea
            placeholder={dict.symptoms.message_to_the_driver}
            className="w-full h-32 text-gray-900 dark:text-white"
          />
        </div>
      </div>
    </div>
  );
}
