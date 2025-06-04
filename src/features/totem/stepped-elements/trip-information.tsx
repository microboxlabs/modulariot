import { I18nRecord } from "@/features/i18n/i18n.service.types";
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

export default function TripInformation({ setCurrentStep, currentStep, dict }: { setCurrentStep: (step: number) => void, currentStep: number, dict: I18nRecord }) {
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("success");
  
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl p-10 bg-white dark:bg-gray-800">
      <h1 className="text-[4vh] portrait:text-[4vw] text-gray-900 dark:text-gray-100">{(dict.totem as I18nRecord).trip_information as string}</h1>
      <hr className="w-full border-gray-300 dark:border-gray-700"></hr>
      <div className="flex flex-row items-stretch justify-between w-full my-[2vh]">
        <DriverInfo number={1} name="Jhon Doe" email="jhon.doe@gmail.com" phone="+569 1234 5678" rut="xx.xxx.xxx-x" state="Verificado" dict={dict} />
        <DriverInfo number={2} name="Jane Doe" email="jane.doe@gmail.com" phone="+569 1234 5678" rut="xx.xxx.xxx-x" state="Verificado" dict={dict} />
      </div>
      <hr className="w-full border-gray-300 dark:border-gray-700"></hr>
      <div className="flex flex-row items-stretch justify-center gap-3 w-full my-[2vh]">
        <div className="flex flex-col justify-center gap-[1vh] w-full">
          <h1 className="text-[3vh] portrait:text-[3vw] font-light text-gray-900 dark:text-gray-100">{(dict.totem as I18nRecord).trip_information as string}</h1>
          <div className="flex flex-col justify-center gap-1 w-full">
            <h1 className="text-[2vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">{(dict.totem as I18nRecord).trip_information_client as string}: <span className="font-light">Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.</span></h1>
            <h1 className="text-[2vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">{(dict.totem as I18nRecord).trip_information_origin_destination as string}: <span className="font-light">xxx - xxx</span></h1>
            <h1 className="text-[2vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">{(dict.totem as I18nRecord).trip_information_schedule as string}: <span className="font-light">8:00 am - 16:00 pm</span></h1>
          </div>
        </div>
      </div>
      <button onClick={() => setCurrentStep(currentStep + 1)} disabled={status !== "success"} className="bg-blue-500 text-white p-4 rounded-2xl w-full flex items-center justify-center">
        <p className="text-[4vh] portrait:text-[4vw] font-light">{(dict.totem as I18nRecord).continue as string}</p>
      </button>
    </div>
  )
}

function DriverInfo({ number, name, email, phone, rut, state, dict }: { number: number, name: string, email: string, phone: string, rut: string, state: string, dict: I18nRecord }) {
  return (
    <div className="flex flex-col items-center justify-center gap-7 w-full">
      <div className="flex flex-col justify-center w-full">
        <h1 className="text-[3vh] portrait:text-[3vw] font-bold text-gray-900 dark:text-gray-100">{name}</h1>
        <h1 className="text-[2vh] portrait:text-[2vw] font-light text-gray-900 dark:text-gray-400">{(dict.totem as I18nRecord).driver as string} {number}</h1>
      </div>
      <div className="flex flex-col justify-center gap-3 w-full">
        <h1 className="text-[2.5vh] portrait:text-[2.5vw] font-bold text-gray-900 dark:text-gray-100">{(dict.totem as I18nRecord).contact_information as string}</h1>
        <div className="flex flex-col justify-center gap-[1vh] w-full">
          <h1 className="text-[2vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">{(dict.totem as I18nRecord).email as string}: <span className="font-light">{email}</span></h1>
          <h1 className="text-[2vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">{(dict.totem as I18nRecord).state as string}: <span className="font-light">{state}</span></h1>
          <h1 className="text-[2vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">{(dict.totem as I18nRecord).phone as string}: <span className="font-light">{phone}</span></h1>
          <h1 className="text-[2vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">{(dict.totem as I18nRecord).rut as string}: <span className="font-light">{rut}</span></h1>
        </div>
      </div>
    </div>
  )
}