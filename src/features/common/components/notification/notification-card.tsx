"use client";

import { useState, useRef, useEffect } from "react";
import { SlOptionsVertical } from "react-icons/sl";
import { FaEye, FaCheck } from "react-icons/fa";

export default function NotificationCard({
  name,
  message,
  timeStamp,
}: {
  name: string;
  message: string;
  timeStamp: string;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOptions) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        optionsRef.current &&
        !optionsRef.current.contains(event.target as Node)
      ) {
        setShowOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showOptions]);

  return (
    <div className="flex items-center flex-row gap-2 bg-gray-200 dark:bg-gray-800 rounded-lg p-2 transition-all duration-300 hover:bg-gray-300 dark:hover:bg-gray-700 cursor-pointer">
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
        {name[0]}
      </div>
      <div className="flex flex-row justify-between items-center w-full">
        {/* Inner content */}
        <div className="flex flex-col">
          <div className="text-sm font-light text-gray-200">{message}</div>
          <div className="text-sm text-gray-500">{timeStamp}</div>
        </div>
        {/* Options */}
        <div className="flex flex-row gap-2">
          <div>
            <div className="text-sm text-gray-500 p-2 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setShowOptions(!showOptions);
              }}
            >
              <SlOptionsVertical />
            </div>
            {showOptions && (
              <div className="relative">
                <div
                  ref={optionsRef}
                  className="absolute top-2 right-0 rounded-md bg-gray-200 dark:bg-gray-700 flex flex-col  overflow-hidden"
                >
                  <div className="font-light text-sm px-4 py-2 text-gray-300 whitespace-nowrap flex flex-row items-center gap-2 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600">
                    <FaEye />View
                  </div>
                  <div className="font-light text-sm px-4 py-2 text-gray-300 whitespace-nowrap flex flex-row items-center gap-2 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600">
                    <FaCheck />Mark as read
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}