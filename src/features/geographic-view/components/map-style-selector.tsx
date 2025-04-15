import { useState } from "react";
import street from "@assets/map_selection/street.png";
import satellite from "@assets/map_selection/satelital.png";
import outdoors from "@assets/map_selection/outdoor.png";
import dark from "@assets/map_selection/dark.png";
import light from "@assets/map_selection/light.png";
import Image from "next/image";
const mapstyles = [
  {
    img: street,
    text: "Calles",
    value: "streets",
  },
  {
    img: satellite,
    text: "Satelital",
    value: "satellite",
  },
  {
    img: outdoors,
    text: "Outdoors",
    value: "outdoors",
  },
  {
    img: dark,
    text: "Dark",
    value: "dark",
  },
  {
    img: light,
    text: "Light",
    value: "light",
  },
];

export default function MapStyleSelector({
  selectedStyle,
  setSelectedStyle,
}: {
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className=" absolute bottom-10 left-5 flex flex-row space-x-[-2.5rem] hover:space-x-2 transition-all duration-300 cursor-pointer"
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
            className={`transition-all duration-300 rounded-md p-1 first:p-0 ${open ? "h-20 w-20" : "h-10 w-10"} ${
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
              className={`h-full w-full object-cover rounded-md transition-all duration-300 ${open ? "border border-gray-500 hover:border-gray-900 dark:hover:border-white" : ""}`}
            />
          </div>
        ))}
    </div>
  );
}
