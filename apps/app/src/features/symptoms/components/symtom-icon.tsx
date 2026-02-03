import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { getSymptom } from "./table-item.type";
import Image from "next/image";
import { Tooltip } from "flowbite-react";
export default function SymptomIcon({
  type,
  size = "h-10 w-10",
  dict,
  placement = "top",
  fixed_label = null,
}: {
  type: string;
  size?: string;
  dict: I18nRecord;
  placement?: "top" | "bottom" | "left" | "right";
  fixed_label?: string | null;
}) {
  return (
    <Tooltip
      style="auto"
      placement={placement}
      content={
        <div className="z-50 px-2 py-1 text-sm text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-600 rounded-md whitespace-nowrap">
          {fixed_label
            ? fixed_label
            : ((dict.symptoms as I18nRecord)[type as string] as string)
              ? ((dict.symptoms as I18nRecord)[type as string] as string)
                  .charAt(0)
                  .toUpperCase() +
                ((dict.symptoms as I18nRecord)[type as string] as string)
                  .slice(1)
                  .toLowerCase()
              : type}
        </div>
      }
    >
      <div
        className={`${size} display-flex justify-center items-center rounded-full cursor-pointer`}
      >
        <Image
          src={getSymptom(type).icon}
          alt={type}
          width={100}
          height={100}
        />
      </div>
    </Tooltip>
  );
}
