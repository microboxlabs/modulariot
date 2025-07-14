import Image from "next/image";
import noAlarmImage from "@assets/images/no_alarm.gif";
import maskImage from "@assets/images/mask.gif";
import hospitalImage from "@assets/images/hospital.svg";
import patchImage from "@assets/images/patch.gif";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import { I18nRecord } from "@/features/i18n/i18n.service.types";


export default function Conditions({ dict }: { dict: I18nRecord }) {
  return (
    <div className="w-full h-full rounded-lg flex gap-2 flex-col overflow-hidden whitespace-nowrap justify-between">
        <h1 className="text-lg text-gray-800 dark:text-gray-200">
          Síntomas presentes en el viaje
        </h1>
        <div className="flex flex-col gap-2 w-full">
          {/* Code black */}
          <div className="flex flex-row gap-2 items-center w-full rounded-lg p-1 border border-gray-300 dark:border-gray-700">
            <Image
              className="w-[35px] h-[35px]"
              src={noAlarmImage}
              alt="Síntomas Urgentes"
              width={35}
              height={35}
            />
            <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
              <div className="flex flex-row gap-2 items-center w-full">
                <ConditionIcon
                  condition="code black"
                  size="h-7 w-7"
                  dict={dict as unknown as I18nRecord}
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Codigo Negro
                </p>
              </div>
              <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
                00
              </h1>
            </div>
          </div>
          {/* Critical condition */}
          <div className="flex flex-row gap-2 items-center w-full rounded-lg p-1 border border-gray-300 dark:border-gray-700">
            <Image
              className="w-[35px] h-[35px]"
              src={hospitalImage}
              alt="Síntomas Urgentes"
              width={35}
              height={35}
            />
            <div className="flex flex-row gap-1 w-full">
              <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
                <div className="flex flex-row gap-2 items-center w-full">
                  <ConditionIcon
                    condition="critic"
                    size="h-7 w-7"
                    dict={dict as unknown as I18nRecord}
                  />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Condición crítica
                  </p>
                </div>
                <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
                  00
                </h1>
              </div>
              <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
                <div className="flex flex-row gap-2 items-center w-full">
                  <ConditionIcon
                    condition="compromised"
                    size="h-7 w-7"
                    dict={dict as unknown as I18nRecord}
                  />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Condición comprometida
                  </p>
                </div>
                <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
                  00
                </h1>
              </div>
            </div>
          </div>
          {/* Treatment and observation */}
          <div className="flex flex-row gap-2 items-center w-full rounded-lg p-1 border border-gray-300 dark:border-gray-700">
            <Image
              className="w-[35px] h-[35px]"
              src={maskImage}
              alt="Síntomas Urgentes"
              width={35}
              height={35}
            />
            <div className="flex flex-row gap-1 w-full">
              <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
                <div className="flex flex-row gap-2 items-center w-full">
                  <ConditionIcon
                    condition="treatment"
                    size="h-7 w-7"
                    dict={dict as unknown as I18nRecord}
                  />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    En tratamiento
                  </p>
                </div>
                <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
                  00
                </h1>
              </div>
              <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
                <div className="flex flex-row gap-2 items-center w-full">
                  <ConditionIcon
                    condition="observation"
                    size="h-7 w-7"
                    dict={dict as unknown as I18nRecord}
                  />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    En observación
                  </p>
                </div>
                <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
                  00
                </h1>
              </div>
            </div>
          </div>
          {/* Stable */}
          <div className="flex flex-row gap-2 items-center w-full rounded-lg p-1 border border-gray-300 dark:border-gray-700">
            <Image
              className="w-[35px] h-[35px]"
              src={patchImage}
              alt="Síntomas Urgentes"
              width={35}
              height={35}
            />
            <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
              <div className="flex flex-row gap-2 items-center w-full">
                <ConditionIcon
                  condition="stable"
                  size="h-7 w-7"
                  dict={dict as unknown as I18nRecord}
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Estable
                </p>
              </div>
              <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">
                00
              </h1>
            </div>
          </div>
        </div>
        <h2 className="text-sm text-gray-800 dark:text-gray-200">
          Totales: 28 síntomas detectados 20 tratados con éxito
        </h2>
      </div>
  );
}