/*

        text: "Con viaje",
        filter_value: "true",
        code: "1",
        icon: (
          <CustomTooltip
            content = "with_trip"
          >
            <div className="flex justify-center items-center w-full h-full bg-blue-600 rounded-full">
              <PinIcon disabled_style_change={true} />
            </div>
          </CustomTooltip>
        ),
        activated: true,
*/

import React from "react";

export default function FilterOption(
  {
    text,
    filter_value,
    code,
    icon,
    activated,
    onClick
  } :
  {
    text: string;
    filter_value: string;
    code: string;
    icon: React.ReactNode;
    activated: boolean;
    onClick?: () => void;
  }
) {
  return <div
    onClick={onClick}
    className={`w-8 h-8 bg-slate-100 dark:bg-slate-800 ${activated ? "outline-2 outline-white" : ""}  rounded-full flex items-center justify-center transition-all duration-100 hover:cursor-pointer hover:border-gray-300`}
  >
    {icon}
  </div>
}