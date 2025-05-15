import { useState } from "react";
import street from "@assets/map_selection/street.png";
import satellite from "@assets/map_selection/satelital.png";
import outdoors from "@assets/map_selection/outdoor.png";
import dark from "@assets/map_selection/dark.png";
import light from "@assets/map_selection/light.png";
import Image from "next/image";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
const mapstyles = [
  {
    img: street,
    text: "streets",
    value: "streets",
  },
  {
    img: satellite,
    text: "satelital",
    value: "satellite",
  },
  {
    img: outdoors,
    text: "outdoors",
    value: "outdoors",
  },
  {
    img: dark,
    text: "dark",
    value: "dark",
  },
  {
    img: light,
    text: "light",
    value: "light",
  },
];

export default function MapStyleSelector({
  selectedStyle,
  setSelectedStyle,
  dict,
}: {
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
  dict: I18nRecord;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="flex flex-row space-x-[-2.5rem] hover:space-x-2 transition-all duration-300 cursor-pointer"
      onClick={() => {
        if (!open) {
          setOpen(!open);
        }
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {[...mapstyles]
        .sort((a, b) =>
          a.value === selectedStyle ? -1 : b.value === selectedStyle ? 1 : 0,
        )
        .map((style) => (
          <div
            key={style.value}
            className={`overflow-hidden bg-gray-500 border transition-all duration-300 rounded-md first:p-0 ${open ? "border-gray-500 hover:border-gray-900 dark:hover:border-white w-20" : "border-gray-500 h-10 w-10"} ${
              selectedStyle === style.value ? "z-10" : "z-0"
            }`}
            onClick={() => {
              if (open) {
                setSelectedStyle(style.value);
              }
            }}
          >
            <Image
              src={style.img}
              alt={style.text}
              width={800}
              height={800}
              className={`w-full object-cover transition-all duration-300 ${open ? "h-20 w-20" : "h-10 w-10"}`}
            />
            <div
              className={`font-light bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-center text-sm py-1 ${open ? "animate-show-flex" : "animate-hide-flex"} justify-center items-center`}
              style={{
                animation: open
                  ? "show-flex 0.3s ease-in-out"
                  : "hide-flex 0.3s ease-in-out",
              }}
            >
              {
                (dict.geographic_view as I18nRecord)[
                  style.text as keyof typeof dict.geographic_view
                ] as string
              }
            </div>
          </div>
        ))}
    </div>
  );
}
