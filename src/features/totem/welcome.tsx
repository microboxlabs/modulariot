import { FaArrowRight } from "react-icons/fa";
import { I18nRecord } from "../i18n/i18n.service.types";

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
          <button
            onClick={() => setCurrentOption(currentOption + 1)}
            className="bg-blue-500 text-white p-4 rounded-2xl w-full flex items-center justify-center"
          >
            <p className="text-[4vh] portrait:text-[4vw] font-light">
              {(dict.totem as I18nRecord).start as string}
            </p>
            <FaArrowRight className="w-[3vh] portrait:w-[3vw] h-[3vh] portrait:h-[3vw]" />
          </button>
        </div>
      </div>
    </div>
  );
}
