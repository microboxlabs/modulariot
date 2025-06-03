import { FloatingLabel } from "flowbite-react";
import { FaArrowRight, FaIdCard } from "react-icons/fa";

export default function Rut({ setCurrentStep, currentStep }: { setCurrentStep: (step: number) => void, currentStep: number }) {
  return (
      <div className="flex flex-col items-center justify-center gap-5 bg-white dark:bg-gray-800 rounded-2xl p-10 landscape:p-10 shadow-md">
        <h1 className="text-[5vh] portrait:text-[5vw] text-gray-700 font-light dark:text-gray-300">Ingrese su N° de RUT</h1>
        <div className="relative w-[50vh] portrait:w-[50vw] h-14 portrait:h-20">
          <span className="absolute left-[1vh] portrait:left-[1vw] top-1/2 -translate-y-1/2 text-gray-400">
            <FaIdCard className="w-[3vh] h-[3vh] portrait:w-[3vw] portrait:h-[3vw]" />
          </span>
          <input
            type="text"
            placeholder="RUT"
            className="pl-[5vh] portrait:pl-[5vw] w-full h-full caret-gray-800 dark:caret-gray-200 p-2 text-3xl font-light rounded-md border-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
          />
        </div>
        <button onClick={() => setCurrentStep(currentStep + 1)} className="bg-blue-500 text-white p-4 rounded-2xl w-full flex items-center justify-center gap-2">
          <p className="text-[4vh] portrait:text-[4vw] font-light">Comenzar</p>
        </button>
      </div>
  );
}