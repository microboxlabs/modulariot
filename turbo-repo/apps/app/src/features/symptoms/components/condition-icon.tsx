import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Conditions } from "./table-item.type";
import Image from "next/image";
import { Tooltip } from "flowbite-react";
export default function ConditionIcon({
  condition,
  size = "h-10 w-10",
  dict,
  placement = "top",
}: {
  condition: string;
  size?: string;
  dict: I18nRecord;
  placement?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <div className="relative inline-block">
      <Tooltip
        style="auto"
        placement={placement}
        content={
          <div className="z-50 px-2 py-1 text-sm text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-600 rounded-md whitespace-nowrap shadow-lg border border-gray-200 dark:border-gray-500 text-center">
            {((dict.symptoms as I18nRecord)[condition as string] as string)
              ? ((dict.symptoms as I18nRecord)[condition as string] as string)
                  .charAt(0)
                  .toUpperCase() +
                ((dict.symptoms as I18nRecord)[condition as string] as string)
                  .slice(1)
                  .toLowerCase()
              : "Sin condición"}
          </div>
        }
      >
        <div
          className={`${size} display-flex justify-center items-center ${Conditions[condition as keyof typeof Conditions]?.innerColor} ${Conditions[condition as keyof typeof Conditions]?.color} border-2 rounded-full cursor-pointer`}
        >
          <Image
            src={Conditions[condition as keyof typeof Conditions]?.icon}
            alt={condition}
            width={100}
            height={100}
          />
        </div>
      </Tooltip>
    </div>
  );
}
