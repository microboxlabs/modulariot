import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { FaIdCard } from "react-icons/fa";
import { useEffect, useState } from "react";
import { isRutValid } from "@/utils/rut";
import { Button } from "flowbite-react";

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
    <div className="flex flex-col gap-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-4 w-full shadow-md ">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg text-gray-700 font-light dark:text-gray-300">
          {(dict.totem as I18nRecord).write_your_rut as string}
        </h1>
        <div className="relative w-full h-10 flex flex-row items-center border-2 border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
          <div className=" h-full text-gray-400 pl-2 pr-1 py-2 flex items-center">
            <FaIdCard className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="RUT"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            className="w-full h-full caret-gray-800 dark:caret-gray-200 font-light border-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-base pl-1 px-2 "
          />
        </div>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button
        onClick={handleValidateRut}
        className="bg-blue-500 text-white p-2 rounded-lg w-full flex items-center justify-center disabled:opacity-50"
        color="blue"
      >
        <p className="text-base font-light">
          {(dict.totem as I18nRecord).continue as string}
        </p>
      </Button>
    </div>
  );
}
