import Image from "next/image";
import blue_pin from "@assets/pin/blue_pin.svg";
import black_code from "@assets/icons/map/conditions_separated/codigo_negro.svg";
import compromised_code from "@assets/icons/map/conditions_separated/comprometida.svg";
import critical_code from "@assets/icons/map/conditions_separated/critica.svg";
import observation_code from "@assets/icons/map/conditions_separated/observacion.svg";
import treatment_code from "@assets/icons/map/conditions_separated/tratamiento.svg";
import stable_code from "@assets/icons/map/conditions_separated/estable.svg";
import "./style/orbitation.css";

export default function EmptyAnimation() {
  return (
    <div className="relative flex flex-col justify-center items-center">
        <div className="border-2 border-gray-300 dark:border-gray-600 rounded-full h-[320px] w-[320px] flex justify-center items-center">
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-full h-[230px] w-[230px] flex justify-center items-center">
            <div className="border-2 border-gray-300 dark:border-gray-600 rounded-full h-[150px] w-[150px] flex justify-center items-center">
              <div className="absolute h-20 w-20 bg-gray-100 dark:bg-gray-700 rounded-full flex justify-center items-center">
                <Image
                  src={blue_pin}
                  alt="Orbitation"
                  width={1000}
                  height={1000}
                  unoptimized
                  className="h-16 w-16"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-1 rounded-full">
          <Image
            src={black_code}
            alt="Orbitation"
            width={1000}
            height={1000}
            className="h-16 w-16"
          />
        </div>
        <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-2 rounded-full">
          <Image
            src={compromised_code}
            alt="Orbitation"
            width={1000}
            height={1000}
            className="h-16 w-16"
          />
        </div>
        <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-3 rounded-full">
          <Image
            src={critical_code}
            alt="Orbitation"
            width={1000}
            height={1000}
            className="h-16 w-16"
          />
        </div>
        <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-4 rounded-full">
          <Image
            src={observation_code}
            alt="Orbitation"
            width={1000}
            height={1000}
            className="h-16 w-16"
          />
        </div>
        <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-5 rounded-full">
          <Image
            src={treatment_code}
            alt="Orbitation"
            width={1000}
            height={1000}
            className="h-16 w-16"
          />
        </div>
        <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-6 rounded-full">
          <Image
            src={stable_code}
            alt="Orbitation"
            width={1000}
            height={1000}
            className="h-16 w-16"
          />
        </div>
      </div>
  )
}