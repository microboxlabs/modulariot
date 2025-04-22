import { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { DriverContactInfoProps } from "./driver-contact-info.type";
import { MdOutlineEmail } from "react-icons/md";
import { FaPhone } from "react-icons/fa";

export default function DriverContactInfo({
  msg,
  driver,
}: DriverContactInfoProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex-1 flex flex-row items-end gap-1">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {driver.name}
        </span>
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord)[driver.varName] as string}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <span className="text-sm font-light leading-loose text-gray-900 dark:text-white">
          {(msg.cards as I18nRecord).driverContactInfo as string}
        </span>
        <div className="flex flex-row flex-wrap gap-1">
          <span className="whitespace-nowrap flex items-center gap-1 flex-row border border-gray-400 w-fit rounded-md p-1 text-gray-400 text-xs">
            <MdOutlineEmail /> {driver.email}
          </span>
          <span className="whitespace-nowrap flex items-center gap-1 flex-row border border-gray-400 w-fit rounded-md p-1 text-gray-400 text-xs">
            {(msg.cards as I18nRecord).status as string}:{" "}
            {(msg.cards as I18nRecord)[driver.status] as string}
          </span>
          <span className="whitespace-nowrap flex items-center gap-1 flex-row border border-gray-400 w-fit rounded-md p-1 text-gray-400 text-xs">
            <FaPhone />
            <a href={`tel:${driver.phone}`} className="underline">
              {driver.phone}
            </a>
          </span>
          <span className="whitespace-nowrap flex items-center gap-1 flex-row border border-gray-400 w-fit rounded-md p-1 text-gray-400 text-xs tracking-tight">
            {(msg.cards as I18nRecord).rut as string}: {driver.rut}
          </span>
        </div>
      </div>
    </div>
  );
}
