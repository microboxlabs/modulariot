"use client";
import React, { useState } from "react";
import { Button } from "flowbite-react";
import { IconType } from "react-icons";
import Image from "next/image";
import { twMerge } from "tailwind-merge";

type MapButtonType = {
  main_color: string;
  button_color: string;
  icon: IconType | string;
  icon_size?: string;
  text: string;
  open_to_left?: boolean;
  onClick?: () => void;
  activated?: boolean;
  hover_disabled?: boolean;
  border?: string;
  disable_label_after_click?: boolean;
};

export default function MapButton({
  main_color,
  button_color,
  icon: Icon,
  icon_size = "w-5 h-5",
  text,
  open_to_left = false,
  onClick,
  activated = false,
  hover_disabled = false,
  disable_label_after_click = false,
  border = "",
}: MapButtonType) {
  const [expanded, set_expanded] = useState(false);

  return (
    <div
      className={twMerge(
        "flex h-10 transition-all duration-300 rounded-full",
        open_to_left ? "flex-row-reverse justify-self-end" : "flex-row",
        main_color
      )}
    >
      <Button
        onClick={() => {
          if (!hover_disabled && !disable_label_after_click) {
            set_expanded(false);
          }
          onClick?.();
        }}
        onMouseEnter={() => {
          if (!hover_disabled) {
            set_expanded(true);
          }
        }}
        onMouseLeave={() => {
          set_expanded(false);
        }}
        color="alternative"
        pill
        className={twMerge(
          // "display-block w-10 h-10",
          "flex items-center justify-center h-10 w-10 !p-0 transition-transform duration-100 z-20 rounded-full",
          // button_color,
          border
        )}
        // theme={{
        //   base: "group relative flex items-stretch justify-center p-0 text-center font-medium transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow] focus:z-10 focus:outline-none",
        //   color: {
        //     gray: ":ring-cyan-700 bg-white text-gray-900 focus:text-cyan-700 focus:ring-4 enabled:hover:bg-gray-100 enabled:hover:text-cyan-700 dark:bg-transparent dark:text-gray-400 dark:enabled:hover:bg-gray-700 dark:enabled:hover:text-white",
        //   },
        //   size: {
        //     md: "px-0 py-0 w-10 h-10 flex items-center justify-center",
        //   },
        // }}
      >
        {typeof Icon === "string" ? (
          <div
            className={twMerge("flex items-center justify-center", icon_size)}
          >
            <Image src={Icon} alt="icono" width={100} height={100} />
          </div>
        ) : React.isValidElement(Icon) ? (
          <div
            className={twMerge("flex items-center justify-center", icon_size)}
          >
            {Icon}
          </div>
        ) : (
          <Icon
            className={twMerge(
              "transition-transform duration-600",
              icon_size,
              activated ? "rotate-180" : "rotate-0"
            )}
          />
        )}
      </Button>
      <p
        style={{ pointerEvents: "none" }}
        className={twMerge(
          "text-gray-800 dark:text-white text-[14px] font-size mx-5 h-10 flex items-center transition-all duration-300 whitespace-nowrap overflow-hidden",
          expanded
            ? "opacity-100 max-w-96"
            : "w-0 opacity-0 overflow-hidden m-0"
        )}
      >
        {text}
      </p>
    </div>
  );
}
