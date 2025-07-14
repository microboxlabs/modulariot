import { FileInput, Label, TextInput } from "flowbite-react";
import { ImageComponent } from "@/features/geographic-view/components/image-viewer/image-selector";
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
      

      

      {/* Forum */}
      {/*
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
        */}
      
    </div>
  );
}
