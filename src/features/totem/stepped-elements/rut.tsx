import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { FaIdCard } from "react-icons/fa";
import { useEffect, useState } from "react";
import { isRutValid } from "@/utils/rut";

export default function Rut({
  setCurrentStep,
  currentStep,
  dict,
  onRutValidated,
  rut,
  setRut,
}: {
  setCurrentStep: (step: number) => void;
  currentStep: number;
  dict: I18nRecord;
  onRutValidated: (data: { rut: string }) => void;
  rut: string;
  setRut: (rut: string) => void;
}) {
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= 3) {
      setCurrentStep(3);
    }
  }, [count]);

  const handleValidateRut = async () => {
    if (!rut.trim()) {
      setError((dict.totem as I18nRecord).rut_required as string);
      setCount(count + 1);
      return;
    }
    let rutText = rut;
    if (!rutText.includes("-")) {
      //add a - to the rut int the positon before the last digit
      rutText = rutText.slice(0, -1) + "-" + rutText.slice(-1);
      setRut(rutText);
    }

    if (!isRutValid(rutText)) {
      setError((dict.totem as I18nRecord).rut_invalid as string);
      setCount(count + 1);
      return;
    }
    onRutValidated({ rut: rutText });
    setCurrentStep(currentStep + 1);
  };

  return (
    <div className="flex flex-col gap-5 bg-gray-100 dark:bg-gray-800 rounded-2xl p-10 w-full md:w-fit shadow-md ">
      <h1 className="text-[3vh] portrait:text-[5vw] text-gray-700 font-light dark:text-gray-300">
        {(dict.totem as I18nRecord).write_your_rut as string}
      </h1>
      <div className="relative w-[50vh] portrait:w-[50vw] h-14 portrait:h-20">
        <span className="absolute left-[1vh] portrait:left-[2vw] top-1/2 -translate-y-1/2 text-gray-400">
          <FaIdCard className="w-[3vh] h-[3vh] portrait:w-[3vw] portrait:h-[3vw]" />
        </span>
        <input
          type="text"
          placeholder="RUT"
          value={rut}
          onChange={(e) => setRut(e.target.value)}
          className="pl-[5vh] portrait:pl-[6vw] w-full h-full caret-gray-800 dark:caret-gray-200 p-2 text-3xl font-light rounded-md border-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        onClick={handleValidateRut}
        className="bg-blue-500 text-white p-4 rounded-2xl w-full flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <p className="text-[4vh] portrait:text-[4vw] font-light">
          {(dict.totem as I18nRecord).continue as string}
        </p>
      </button>
    </div>
  );
}
