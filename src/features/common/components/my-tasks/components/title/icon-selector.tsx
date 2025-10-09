/* import { Status } from "./title-poc"; */
import { FaBook /* , FaClock, FaPlusCircle, FaMapPin */ } from "react-icons/fa";
/* import { useState } from "react"; */

export default function IconSelector({ state }: { state: string }) {
  /* const [open, setOpen] = useState(false); */

  if (state != null) {
    return (
      <div className="relative text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md w-10 h-10 p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        abc
        <div className="absolute top-full left-0 bg-red-500 z-20 mt-2"></div>
      </div>
    );
  }

  return (
    <div className="text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md w-10 h-10 p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
      <FaBook className="h-4 w-4" />
    </div>
  );
}
