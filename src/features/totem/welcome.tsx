import { FaArrowRight } from "react-icons/fa";
import { I18nRecord } from "../i18n/i18n.service.types";
import { Button } from "flowbite-react";

export default function Welcome({
  setCurrentOption,
  currentOption,
  dict,
}: {
  setCurrentOption: (option: number) => void;
  currentOption: number;
  dict: I18nRecord;
}) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-10">
      {/* Title */}
      <div className="flex flex-col items-center justify-center p-3 rounded-md gap-10">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-[6vh] portrait:text-[6vw] font-bold text-gray-900 dark:text-white">
            {(dict.totem as I18nRecord).welcome as string}
          </h1>
          <p className="text-[4vh] portrait:text-[4vw] text-gray-500 ">
            {(dict.totem as I18nRecord).subtitle as string}
          </p>
        </div>
        {/* Form */}
        <div className="flex flex-col items-center justify-center w-full">
          <Button
            onClick={() => setCurrentOption(currentOption + 1)}
            className="bg-[#F1B300] dark:bg-[#F1B300] text-black dark:text-black hover:bg-white dark:hover:bg-white border-1 font-bold p-2 rounded-lg w-full flex items-center justify-center disabled:opacity-50"
            color="white"
          >
            <div className="flex items-center justify-center w-full gap-1">
              <p className="text-xl font-light">
                {(dict.totem as I18nRecord).start as string}
              </p>
              <div className="flex items-center justify-center w-full">
                <FaArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
