import { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { DriverContactInfoProps } from "./driver-contact-info.type";

export default function DriverContactInfo({
  msg,
  driver,
}: DriverContactInfoProps) {
  return (
    <div className="flex gap-5 sm:min-w-[400px] lg:min-w-[600px]">
      <div className="flex-1 flex flex-col">
        <h5 className="text-sm font-medium leading-loose">{driver.name}</h5>
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord)[driver.varName] as string}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2.5">
        <span className="text-sm font-medium leading-loose">
          {(msg.cards as I18nRecord).driverContactInfo as string}
        </span>
        <span className="text-gray-400 text-xs">
          {(msg.cards as I18nRecord).email as string}: {driver.email}
        </span>
        <span className="text-gray-400 text-xs">
          {(msg.cards as I18nRecord).status as string}:{" "}
          {(msg.cards as I18nRecord)[driver.status] as string}
        </span>
        <span className="text-gray-400 text-xs">
          {(msg.cards as I18nRecord).phone as string}:{" "}
          <a href={`tel:${driver.phone}`} className="underline">
            {driver.phone}
          </a>
        </span>
        <span className="text-gray-400 text-xs tracking-tight">
          {(msg.cards as I18nRecord).rut as string}: {driver.rut}
        </span>
      </div>
    </div>
  );
}
