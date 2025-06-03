import { useState } from "react";
import { IoIosFingerPrint } from "react-icons/io";

const status_icon = {
  "idle": {
    style: "text-gray-500 border-gray-500",
    text: "Ingrese su dedo indice de la mano derecha en el lector."
  },
  "scanning": {
    style: "text-blue-500 animate-pulse border-blue-500",
    text: "Cargando..."
  },
  "success": {
    style: "text-green-500 border-green-500",
    text: "Escaneo de huella exitoso."
  },
  "error": {
    style: "text-red-500 border-red-500",
    text: "Error al escanear huella."
  }
}

export default function Huella({ setCurrentStep, currentStep }: { setCurrentStep: (step: number) => void, currentStep: number }) {
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("success");
  
  return (
    <div className="flex flex-col items-center justify-center gap-8 bg-white dark:bg-gray-800 rounded-2xl p-20 shadow-md w-full">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-[6vw] font-light text-gray-900 dark:text-gray-100">Escaneo de huella</h1>
      </div>
      <div className={`p-[1vw] rounded-full border-4 flex items-center justify-center shadow-md ${status_icon[status].style}`}>
          <IoIosFingerPrint className={`w-[10vw] h-[10vw] transition-colors duration-300`} />
      </div>
      <div className="flex flex-col items-center justify-center">
        <p className="text-[4vw] text-gray-600 dark:text-gray-400">{status_icon[status].text}</p>
        <p className={`text-[3.5vw] font-light text-gray-800 dark:text-gray-200 transition-all duration-300 rounded-xl ${status == "success" ? "text-green-500 opacity-100" : "opacity-0"}`}>John Doe</p>
      </div>
      <button onClick={() => setCurrentStep(currentStep + 1)} disabled={status !== "success"} className="text-lg bg-blue-500 text-white px-4 py-2 rounded-2xl w-full h-20 flex items-center justify-center gap-2">
        <p className="text-[3vw] font-light">Continuar</p>
      </button>
    </div>
  );
}