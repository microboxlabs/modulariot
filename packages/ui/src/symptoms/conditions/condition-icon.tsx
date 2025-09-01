import { Conditions } from "../types/table-item.type";
import Image from "next/image";
import { Tooltip } from "flowbite-react";
import CustomTooltip from "../../custom-tooltip";

export default function ConditionIcon({
  condition,
  size = "h-10 w-10",
}: {
  condition: string;
  size?: string;
}) {
  return (
    <div className="relative inline-block">
      <CustomTooltip
        content = {
          <div className="whitespace-nowrap text-center">
            {condition ?? "Sin condición"}
          </div>
        }
        placement = "bottom"
      >
        <div
          className={`${size} display-flex justify-center items-center ${Conditions[condition as keyof typeof Conditions]?.innerColor} ${Conditions[condition as keyof typeof Conditions]?.color} border-2 rounded-full cursor-pointer`}
        >
          <Image
            src={Conditions[condition as keyof typeof Conditions]?.icon || ""}
            alt={condition}
            width={100}
            height={100}
          />
        </div>
      </CustomTooltip>
    </div>
  );
}
