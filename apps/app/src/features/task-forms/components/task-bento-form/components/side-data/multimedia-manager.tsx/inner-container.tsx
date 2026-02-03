import React from "react";
import { IoClose } from "react-icons/io5";

export default function InnerContainer({
  setIsOpen,
  title,
  children,
}: {
  setIsOpen: (isOpen: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute top-0 left-0 w-full h-full flex flex-col gap-2 bg-white dark:bg-gray-800 z-20">
      <div className="rounded-lg flex justify-between">
        <div className="flex flex-row items-center gap-2 p-2 text-lg text-gray-900 dark:text-white">
          {title}
        </div>
        <a
          href="#"
          onClick={() => setIsOpen(false)}
          className="flex h-fit w-fit text-gray-500 items-center gap-2 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer"
        >
          <IoClose className="h-7 w-7" />
        </a>
      </div>
      <div className="flex flex-col gap-2 flex-grow overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
