import Image from "next/image";
import { mapstyles } from "../map-style-selector";

export default function MapSelector({
  selectedStyle,
  setSelectedStyle,
}: {
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
}) {
  return (
    <div className="flex flex-row gap-2">
      {mapstyles.map((style) => (
        <div
          key={style.value}
          className={`flex flex-col items-center w-20 bg-gray-50 border transition-all duration-300 rounded-md first:p-0 overflow-hidden cursor-pointer ${selectedStyle === style.value ? "border-blue-500 border-2" : "hover:border-gray-900 dark:hover:border-white"}`}
          onClick={() => setSelectedStyle(style.value)}
        >
          <Image src={style.img} alt={style.text} width={800} height={800} />
          <p className="text-sm text-gray-500 flex justify-center items-center py-1">
            {style.text}
          </p>
        </div>
      ))}
    </div>
  );
}
