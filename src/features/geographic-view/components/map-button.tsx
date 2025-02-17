"use client";
import { Button } from "flowbite-react";
import { useState } from "react";
import { IconType } from "react-icons";

type MapButtonType = {
  main_color: string;
  button_color: string;
  icon: IconType;
  text: string;
  open_to_left?: boolean;
  onClick?: () => void;
  activated?: boolean;
};

export default function MapButton({
  main_color,
  button_color,
  icon: Icon,
  text,
  open_to_left = false,
  onClick,
  activated = false,
}: MapButtonType) {
  const [expanded, set_expanded] = useState(false);

  return (
    <div className="w-fit flex flex-col items-end">
      <div
        className={`flex ${open_to_left ? "flex-row-reverse justify-self-end" : "flex-row"} ${main_color} transition-all duration-300 rounded-full ${expanded ? "w-full" : "w-10"}`}
      >
        <Button
          onClick={onClick}
          onMouseEnter={() => {
            set_expanded(true);
          }}
          onMouseLeave={() => {
            set_expanded(false);
          }}
          color="gray"
          className={`flex align-middle justify-center h-10 w-10 transition-transform duration-100 z-20 ${button_color} rounded-full`}
        >
          <Icon
            className={`w-5 h-5 transition-transform duration-600 ${activated ? "rotate-180" : "rotate-0"} `}
          />
        </Button>
        <p
          style={{ pointerEvents: "none" }}
          className={` text-gray-800 dark:text-white text-[14px] font-size mx-5 h-10 flex items-center transition-all duration-300 whitespace-nowrap overflow-hidden ${expanded ? "opacity-100" : "opacity-0 overflow-hidden"}`}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
