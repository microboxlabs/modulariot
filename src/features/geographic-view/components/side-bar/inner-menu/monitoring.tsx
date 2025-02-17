import { Label } from "flowbite-react";
import CustomDropdown from "./components/custom_dropdown";
import { HiTruck } from "react-icons/hi";
import { FaArrowsRotate } from "react-icons/fa6";
import { GiAtom } from "react-icons/gi";

export default function Monitoring() {
  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg">General</Label>
      {/* Glota total */}
      <div className="w-full flex flex-col gap-2">
        <CustomDropdown text="Flota total" Icon={HiTruck} />
        <div className="w-full flex flex-col gap-1 text-xs font-normal text-gray-900">
          <p>
            Viajes: <span className="text-gray-500">96</span>
          </p>
          <p>
            Patentes: <span className="text-gray-500">96</span>
          </p>
          <p className="text-red-600">Incidencias: 245</p>
          <p>
            Distancia procesada: <span className="text-gray-500">89.055</span>
          </p>
          <p>
            Duración promedio en KM:{" "}
            <span className="text-gray-500">11:51:07 hrs</span>
          </p>
        </div>
      </div>
      {/* Señales */}
      <div className="w-full flex flex-col gap-2">
        <CustomDropdown text="Señales" Icon={FaArrowsRotate} />
        <div className="w-full flex flex-col gap-1 text-xs font-normal text-gray-900">
          <p>
            Por minuto movimiento: <span className="text-gray-500">5.1</span>
          </p>
          <p>
            Delay: <span className="text-gray-500">00:02:21</span>
          </p>
        </div>
      </div>
      {/* Síntomas <- Contaminacion total */}
      <div className="w-full flex flex-col gap-2">
        <CustomDropdown text="Síntomas" Icon={GiAtom} />
        <div className="w-full flex flex-col gap-1 text-xs font-normal text-gray-900">
          <p>
            Total CO2: <span className="text-gray-500">91.155</span>
          </p>
          <p>
            Metano: <span className="text-gray-500">17</span>
          </p>
          <p>
            Oxido de Nitroso: <span className="text-gray-500">1.034</span>
          </p>
          <p>
            Pozo a tanque: <span className="text-gray-500">15.978</span>
          </p>
        </div>
      </div>
    </div>
  );
}
