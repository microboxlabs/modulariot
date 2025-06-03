import { FloatingLabel } from "flowbite-react";
import { FaArrowRight, FaIdCard } from "react-icons/fa";

export default function Rut({ setCurrentStep, currentStep }: { setCurrentStep: (step: number) => void, currentStep: number }) {
  return (
      <div className="flex flex-col items-center justify-center gap-10 bg-white dark:bg-gray-800 rounded-2xl p-20 shadow-md w-full">
        <h1 className="text-[5vw] text-gray-700 font-light dark:text-gray-300">Ingrese su N° de RUT</h1>
        <div className="relative w-[50vw] h-20">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400">
            <FaIdCard className="w-10 h-10" />
          </span>
          <input
            type="text"
            placeholder="RUT"
            className="pl-20 w-full h-full caret-gray-800 dark:caret-gray-200 p-2 text-3xl font-light rounded-md border-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
          />
        </div>
        <button onClick={() => setCurrentStep(currentStep + 1)} className="text-lg bg-blue-500 text-white p-[2vw] rounded-xl w-full flex items-center justify-center gap-2">
          <p className="text-[3vw] font-light h-10">Comenzar</p>
        </button>
      </div>
  );
}