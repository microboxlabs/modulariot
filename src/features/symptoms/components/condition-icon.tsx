import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Conditions } from "./table-item.type";
import Image from "next/image";
import { Tooltip } from "flowbite-react";
import { logger } from "@/lib/logger";
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
  logger.info(condition);
  return (
    <Tooltip
      style="auto"
      placement={placement}
      theme={{
        arrow: {
          base: "absolute h-2 w-2 rotate-45",
          style: {
            auto: `bg-white dark:bg-gray-600 ${placement === "top" ? "border-r border-b" : placement === "bottom" ? "border-l border-t" : placement === "left" ? "border-r border-t" : "border-l border-b"} border-gray-500 dark:border-gray-400`,
          },
          placement: "-4px",
        },
        base: "absolute inline-block rounded-lg text-sm font-medium shadow-sm",
        style: {
          auto: "border border border-gray-500 dark:border-gray-400 bg-white text-gray-900 dark:bg-gray-700 dark:text-white",
        },
        content: "relative z-50",
      }}
      content={
        <div className="z-50 px-2 py-1 text-sm text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-600 rounded-md whitespace-nowrap">
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
  );
}
