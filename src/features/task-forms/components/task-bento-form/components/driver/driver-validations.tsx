import { FaCheck } from "react-icons/fa";
import { TbExclamationMark } from "react-icons/tb";
import { GoX } from "react-icons/go";
import { Driver } from "@/features/task-forms/components/driver-contact-info/driver-contact-info.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function DriverValidations({
  driver,
  msg,
}: {
  driver: Driver;
  msg: I18nRecord;
}) {
  return (
    <div className="flex flex-col gap-1 h-full justify-center ">
      <div className="flex gap-2 items-center flex-row">
        <Ellipse />
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord).alcoholTest as string}
        </span>
      </div>
      <div className="flex gap-2 items-center flex-row">
        <Ellipse />
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord).drugTest as string}
        </span>
      </div>
      <div className="flex gap-2 items-center flex-row">
        <Ellipse />
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord).sleepinessTest as string}
        </span>
      </div>
    </div>
  );
}

export function Ellipse() {
  return (
    <div className="w-5 h-5 bg-white border border-gray-400 rounded-full flex-shrink-0" />
  );
}

export function CheckCircle() {
  return (
    <div className="w-5 h-5 text-white bg-green-500 border border-gray-400 rounded-full flex items-center justify-center p-1">
      <FaCheck className="w-full h-full" />
    </div>
  );
}

export function Exclamation() {
  return (
    <div className="w-5 h-5 text-white bg-yellow-300 border border-gray-400 rounded-full flex items-center justify-center">
      <TbExclamationMark className="w-full h-full" />
    </div>
  );
}

export function ErrorCircle() {
  return (
    <div className="w-5 h-5 text-white bg-red-500 border border-gray-400 rounded-full flex items-center justify-center">
      <GoX className="w-full h-full" />
    </div>
  );
}
