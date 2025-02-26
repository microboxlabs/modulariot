import { useState } from "react";
import MapButton from "./map-button";
import Image from "next/image";
import { IoClose } from "react-icons/io5";
import { IconType } from "react-icons";
type Option = {
  text: string;
  filter_value: string;
  icon: string;
  activated: boolean;
};

export default function FilterComponent({
  icon,
  options,
  label,
  icon_size = "w-5 h-5",
}: {
  icon: string | IconType;
  options: Option[];
  label: string;
  icon_size?: string;
}) {
  const [expanded, set_expanded] = useState(false);
  const [filter_options, set_filter_options] = useState<Option[]>(options);

  // Calculate the number of activated options
  const activatedCount = filter_options.filter(
    (option) => option.activated,
  ).length;

  return (
    <div className="relative h-full flex flex-row gap-2">
      <div
        className={`relative h-10 ${
          expanded ? "max-w-10" : "max-w-[1000px]"
        } transition-all duration-300`}
      >
        <MapButton
          main_color="bg-white dark:bg-gray-800"
          button_color="bg-white dark:bg-gray-800"
          icon={icon}
          text={label}
          icon_size={icon_size}
          onClick={() => set_expanded(!expanded)}
          hover_disabled={expanded}
        />
        <div className="absolute h-10 w-10 top-0 left-0">
          <div
            className={`flex flex-row items-center justify-center gap-2 absolute transition-all duration-300 right-[-6px] top-[-6px] border-2 border-white z-50 bg-amber-300 rounded-full w-5 h-5 ${
              activatedCount > 0 ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="text-gray-900 text-xs w-5 h-5 text-center mt-1">
              {activatedCount}
            </p>
          </div>
        </div>
      </div>
      <div
        className={`h-10 overflow-hidden transition-all duration-300 ease-in-out !flex justify-center items-center flex-row gap-2 w-fit ${expanded ? "animate-show" : "animate-hide-width"}  `}
      >
        {filter_options.map((option, index) => (
          <div
            onClick={() => {
              const new_options = [...filter_options];
              new_options[index].activated = !new_options[index].activated;
              set_filter_options(new_options);
            }}
            key={index}
            className={`w-8 h-8 bg-blue-500 ${option.activated ? "brightness-100" : "brightness-50"}  rounded-full p-1 flex items-center justify-center transition-all duration-100 hover:cursor-pointer hover:border-2 hover:border-gray-300`}
          >
            <Image src={option.icon} alt="icono" className="w-6 h-6" />
          </div>
        ))}
        <div
          onClick={() => {
            const new_options = [...filter_options];
            new_options.forEach((option) => {
              option.activated = false;
            });
            set_filter_options(new_options);
            set_expanded(false);
          }}
          className="w-7 h-7 bg-red-500 rounded-full p-1 flex items-center justify-center hover:cursor-pointer hover:border-2 hover:border-gray-300"
        >
          <IoClose />
        </div>
      </div>
    </div>
  );
}
