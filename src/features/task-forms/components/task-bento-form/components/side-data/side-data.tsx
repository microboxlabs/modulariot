import { FileInput, Label, TextInput } from "flowbite-react";
import { ImageComponent } from "@/features/geographic-view/components/image-selector";
import Link from "next/link";
import { FaRegFilePdf } from "react-icons/fa";
import Image from "next/image";
import noAlarmImage from "@assets/images/no_alarm.gif";
import maskImage from "@assets/images/mask.gif";
import hospitalImage from "@assets/images/hospital.svg";
import patchImage from "@assets/images/patch.gif";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import Document from "./document";

export default function SideData({ dict }: { dict: I18nRecord }) {
  return (
    <div className="h-fit w-fit portrait:w-full flex flex-col gap-2">
      {/* Update of files */}
      <div className="flex w-full items-center justify-center">
        <Label
          htmlFor="dropzone-file"
          className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600"
        >
          <div className="flex flex-col items-center justify-center pb-6 pt-5">
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-100">
              Multimedia
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-bold text-gray-700 dark:text-gray-200">
                Drag and drop
              </span>{" "}
              a file here or{" "}
              <span className="font-bold text-gray-700 dark:text-gray-200">
                click
              </span> to upload
            </p>
          </div>
          <FileInput id="dropzone-file" className="hidden" />
        </Label>
      </div>

      {/* Images */}
      <div className="gap-2 duration-300 rounded-lg relative">
        <p className="text-sm text-gray-500 dark:text-gray-400">Galeria (12 elementos)</p>
        <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative">
          <ImageComponent
            image={null}
            index={0}
            setSelected={() => {}}
            setSize="h-40 w-full"
            stepped={false}
          />
          <ImageComponent
            image={null}
            index={0}
            setSelected={() => {}}
            setSize="h-40 w-full"
            stepped={false}
          />
          <ImageComponent
            image={null}
            index={0}
            setSelected={() => {}}
            setSize="h-40 w-full"
            stepped={false}
          />
          <ImageComponent
            image={null}
            index={0}
            setSelected={() => {}}
            setSize="h-40 w-full"
            stepped={false}
          />
        </div>
      </div>

      {/* Documents */}
      <div className="gap-2 duration-300 rounded-lg relative">
        <div className="flex flex-row justify-between items-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Documentos (12 elementos)</p>
          <div className="text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed">
            Ver mas
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative">
          <Document />
          <Document />
          <Document />
          <Document />
        </div>
      </div>

      {/* Forum */}
      {
        /*
        <div className="w-full h-96 rounded-lg flex flex-col overflow-hidden border border-gray-300">
        <h1 className="text-sm font-bold p-2">Foro</h1>
        <div className="flex flex-col gap-2 bg-gray-200 h-full p-2">
          <div className="flex flex-row gap-2">
            <div className="border-2 border-green-500 h-8 w-8 rounded-full flex items-center justify-center">K</div>
            <div className="flex flex-col gap-2 p-2">
              <p className="text-sm">Que le pasa que le pasa a mi camion?</p>
            </div>
          </div>
          <div className="flex flex-row gap-2">
            <div className="border-2 border-green-500 h-8 w-8 rounded-full flex items-center justify-center">K</div>
            <div className="flex flex-col gap-2 p-2">
              <p className="text-sm">Que le pasa que le pasa que no arranca?</p>
            </div>
          </div>
        </div>
        <TextInput id="email1" type="text" placeholder="Escribe tu mensaje" required />
      </div>
        */
      }
      <div className="w-fit rounded-lg flex flex-col overflow-hidden whitespace-nowrap min-w-fit">
        <h1 className="text-sm text-gray-800 dark:text-gray-200">Síntomas presentes en el viaje</h1>
        {/* Code black */}
        <div className="flex flex-row gap-2 items-center w-full rounded-lg pl-2 pr-1 py-1 border border-gray-300">
          <Image
            className="w-[35px] h-[35px]"
            src={noAlarmImage}
            alt="Síntomas Urgentes"
            width={35}
            height={35}
          />
          <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 rounded-lg px-2 py-1">
            <div className="flex flex-row gap-2 items-center w-full">
              <ConditionIcon
                condition="code black"
                size="h-7 w-7"
                dict={dict as unknown as I18nRecord}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">Codigo Negro</p>
            </div>
            <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">00</h1>
          </div>
        </div>
        {/* Critical condition */}
        <div className="flex flex-row gap-2 items-center w-full rounded-lg pl-2 pr-1 py-1 border border-gray-300">
          <Image
            className="w-[35px] h-[35px]"
            src={hospitalImage}
            alt="Síntomas Urgentes"
            width={35}
            height={35}
          />
          <div className="flex flex-row gap-1 w-full">
            
          <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 rounded-lg px-2 py-1">
            <div className="flex flex-row gap-2 items-center w-full">
              <ConditionIcon
                condition="critic"
                size="h-7 w-7"
                dict={dict as unknown as I18nRecord}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">Condición crítica</p>
            </div>
            <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">00</h1>
          </div>
          <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 rounded-lg px-2 py-1">
            <div className="flex flex-row gap-2 items-center w-full">
              <ConditionIcon
                condition="compromised"
                size="h-7 w-7"
                dict={dict as unknown as I18nRecord}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">Condición comprometida</p>
            </div>
            <h1 className="text-md text-gray-800 h-full flex items-center justify-center">00</h1>
          </div>
          </div>
        </div>
        {/* Treatment and observation */}
        <div className="flex flex-row gap-2 items-center w-full rounded-lg pl-2 pr-1 py-1 border border-gray-300">
          <Image
            className="w-[35px] h-[35px]"
            src={maskImage}
            alt="Síntomas Urgentes"
            width={35}
            height={35}
          />
          <div className="flex flex-row gap-1 w-full">
            <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 rounded-lg px-2 py-1">
              <div className="flex flex-row gap-2 items-center w-full">
                <ConditionIcon
                  condition="treatment"
                  size="h-7 w-7"
                  dict={dict as unknown as I18nRecord}
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">En tratamiento</p>
              </div>
              <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">00</h1>
            </div>
            <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 rounded-lg px-2 py-1">
              <div className="flex flex-row gap-2 items-center w-full">
                <ConditionIcon
                  condition="observation"
                  size="h-7 w-7"
                  dict={dict as unknown as I18nRecord}
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">En observación</p>
              </div>
              <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">00</h1>
            </div>
          </div>
        </div>
        {/* Stable */}
        <div className="flex flex-row gap-2 items-center w-full rounded-lg pl-2 pr-1 py-1 border border-gray-300">
          <Image
            className="w-[35px] h-[35px]"
            src={patchImage}
            alt="Síntomas Urgentes"
            width={35}
            height={35}
          />
          <div className="w-full flex flex-row gap-2 justify-between items-center border border-gray-300 rounded-lg px-2 py-1">
            <div className="flex flex-row gap-2 items-center w-full">
              <ConditionIcon
                condition="stable"
                size="h-7 w-7"
                dict={dict as unknown as I18nRecord}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">Estable</p>
            </div>
            <h1 className="text-md text-gray-800 dark:text-gray-200 h-full flex items-center justify-center">00</h1>
          </div>
        </div>
      </div>
    </div>
  );
}