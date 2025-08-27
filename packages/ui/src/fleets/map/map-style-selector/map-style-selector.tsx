import { useState } from "react";
import Image from "next/image";
import { mapstyles } from "./map-style.types";

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
      className="flex flex-row space-x-[-2.5rem] hover:space-x-2 transition-all duration-500 ease-out cursor-pointer"
      onClick={() => {
        if (!open) {
          setOpen(!open);
        }
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {[...mapstyles]
        .sort((a, b) =>
          a.value === selectedStyle ? -1 : b.value === selectedStyle ? 1 : 0
        )
        .map((style) => (
          <div
            key={style.value}
            className={`overflow-hidden bg-slate-500 border transition-all duration-300 ease-out rounded-md first:p-0 ${open ? "border-slate-500 hover:border-slate-900 dark:hover:border-white w-20" : "border-slate-500 h-10 w-10"} ${
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
              className={`w-full object-cover transition-all duration-300 ease-out ${open ? "h-20 w-20" : "h-10 w-10"}`}
            />
            <div
              className={`font-light bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-center text-sm py-1 transition-all duration-300 ease-out ${
                open 
                  ? "opacity-100 max-h-8 flex justify-center items-center" 
                  : "opacity-0 max-h-0 hidden"
              }`}
            >
              {style.text}
            </div>
          </div>
        ))}
    </div>
  );
}
