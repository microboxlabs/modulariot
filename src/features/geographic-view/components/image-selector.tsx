import { useState } from "react";
import { FaChevronRight } from "react-icons/fa";

export default function ImageSelector({images}: {images: string[]}) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`h-full flex flex-row items-center justify-start relative pointer-events-auto`}>
      <div className={`h-full bg-white rounded-r-lg border-r-2 border-gray-300 transition-all duration-300 overflow-hidden ${open ? "max-w-full" : "max-w-0"}`}>
        <div className="h-20 w-20 flex flex-col items-center justify-center gap-2 border-b-2 border-gray-300 p-4">
          Ejemplo?
        </div>
      </div>
      <div className={`h-10 bg-white rounded-r-lg p-4 border-r border-y border-gray-200 flex items-center justify-center transition-all duration-300 cursor-pointer`} onClick={() => setOpen(!open)}>
        <FaChevronRight className={`w-5 h-5 transition-all duration-300 ${open ? "rotate-180" : ""}`} />
      </div>
    </div>
  );
}