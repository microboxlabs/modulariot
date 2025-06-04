import { useState } from "react";
import { IoIosFingerPrint } from "react-icons/io";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function Huella({
  setCurrentStep,
  currentStep,
  dict,
}: {
  setCurrentStep: (step: number) => void;
  currentStep: number;
  dict: I18nRecord;
}) {
  const [status, _setStatus] = useState<
    "idle" | "scanning" | "success" | "error"
  >("success");

  const status_icon = {
    idle: {
      style: "text-gray-500 border-gray-500",
      text: (dict.totem as I18nRecord).fingerprint_scan_idle as string,
    },
    scanning: {
      style: "text-blue-500 animate-pulse border-blue-500",
      text: (dict.totem as I18nRecord).loading as string,
    },
    success: {
      style: "text-green-500 border-green-500",
      text: (dict.totem as I18nRecord).fingerprint_scan_success as string,
    },
    error: {
      style: "text-red-500 border-red-500",
      text: (dict.totem as I18nRecord).fingerprint_scan_error as string,
    },
  };

  return (
    <div className="flex flex-col items-center justify-center gap-5 bg-white dark:bg-gray-800 rounded-2xl p-10 shadow-md portrait:w-full">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-[4vh] portrait:text-[4vw] font-light text-gray-900 dark:text-gray-100">
          {(dict.totem as I18nRecord).fingerprint_scan as string}
        </h1>
      </div>
      <div
        className={`p-[1vh] portrait:p-[1vw] rounded-full border-4 flex items-center justify-center shadow-md ${status_icon[status].style}`}
      >
        <IoIosFingerPrint
          className={`w-[10vh] portrait:w-[10vw] h-[10vh] portrait:h-[10vw] transition-colors duration-300`}
        />
      </div>
      <div className="flex flex-col items-center justify-center">
        <p className="text-[3vh] portrait:text-[3vw] text-gray-600 dark:text-gray-400">
          {status_icon[status].text}
        </p>
        <p
          className={`text-[3vh] font-light text-gray-800 dark:text-gray-200 transition-all duration-300 rounded-xl ${status == "success" ? "text-green-500 opacity-100" : "opacity-0"}`}
        >
          John Doe
        </p>
      </div>
      <button
        onClick={() => setCurrentStep(currentStep + 1)}
        disabled={status !== "success"}
        className="bg-blue-500 text-white p-4 rounded-2xl w-full flex items-center justify-center"
      >
        <p className="text-[4vh] portrait:text-[4vw] font-light">
          {(dict.totem as I18nRecord).continue as string}
        </p>
      </button>
    </div>
  );
}
