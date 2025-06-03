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

export default function TripInformation({ setCurrentStep, currentStep }: { setCurrentStep: (step: number) => void, currentStep: number }) {
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("success");
  
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl p-20 bg-white dark:bg-gray-800 w-full">
      <h1 className="text-[5vw] text-gray-900 dark:text-gray-100">Información del viaje</h1>
      <hr className="w-full border-gray-300 dark:border-gray-700"></hr>
      <div className="flex flex-row items-stretch justify-center gap-[3vw] w-full my-[2vw]">
        <DriverInfo number={1} name="Jhon Doe" email="jhon.doe@gmail.com" phone="+569 1234 5678" rut="xx.xxx.xxx-x" state="Verificado" />
        <DriverInfo number={2} name="Jane Doe" email="jane.doe@gmail.com" phone="+569 1234 5678" rut="xx.xxx.xxx-x" state="Verificado" />
      </div>
      <hr className="w-full border-gray-300 dark:border-gray-700"></hr>
      <div className="flex flex-row items-stretch justify-center gap-3 w-full my-[2vw]">
        <div className="flex flex-col justify-center gap-[3vw] w-full">
          <h1 className="text-[4vw] font-light text-gray-900 dark:text-gray-100">Información del viaje</h1>
          <div className="flex flex-col justify-center gap-1 w-full">
            <h1 className="text-[2vw] font-bold text-gray-900 dark:text-gray-400">Información del cliente: <span className="font-light">Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.</span></h1>
            <h1 className="text-[2vw] font-bold text-gray-900 dark:text-gray-400">Origen - Destino: <span className="font-light">xxx - xxx</span></h1>
            <h1 className="text-[2vw] font-bold text-gray-900 dark:text-gray-400">Horario: <span className="font-light">8:00 am - 16:00 pm</span></h1>
          </div>
        </div>
      </div>
      <button onClick={() => setCurrentStep(currentStep + 1)} disabled={status !== "success"} className="text-lg bg-blue-500 text-white px-4 py-2 rounded-2xl w-full h-20 flex items-center justify-center gap-2">
        <p className="text-[3vw] font-light">Comenzar</p>
      </button>
    </div>
  )
}

function DriverInfo({ number, name, email, phone, rut, state }: { number: number, name: string, email: string, phone: string, rut: string, state: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-7 w-full">
      <div className="flex flex-col justify-center w-full">
        <h1 className="text-[4vw] font-light text-gray-900 dark:text-gray-100">{name}</h1>
        <h1 className="text-[2vw] font-light text-gray-900 dark:text-gray-400">Conductor {number}</h1>
      </div>
      <div className="flex flex-col justify-center gap-3 w-full">
        <h1 className="text-[2.5vw] font-light text-gray-900 dark:text-gray-100">Información contacto</h1>
        <div className="flex flex-col justify-center gap-[1vw] w-full">
          <h1 className="text-[1.5vw] font-bold text-gray-900 dark:text-gray-400">Correo electrónico: <span className="font-light">{email}</span></h1>
          <h1 className="text-[1.5vw] font-bold text-gray-900 dark:text-gray-400">Estado: <span className="font-light">{state}</span></h1>
          <h1 className="text-[1.5vw] font-bold text-gray-900 dark:text-gray-400">Teléfono: <span className="font-light">{phone}</span></h1>
          <h1 className="text-[1.5vw] font-bold text-gray-900 dark:text-gray-400">Rut: <span className="font-light">{rut}</span></h1>
        </div>
      </div>
    </div>
  )
}