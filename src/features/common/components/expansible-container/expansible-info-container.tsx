"use client";
import React, { useState } from "react";
interface ExpandableButtonProps {
  initial_state?: boolean;
  icon: React.ReactElement;
  head: React.ReactNode;
  children: React.ReactNode;
}

export default function ExpansibleInfoContainer({
  initial_state = false,
  icon,
  head,
  children,
}: ExpandableButtonProps) {
  const [isExpanded, setIsExpanded] = useState(initial_state);

  return (
    <div className="hover:cursor-pointer rounded-md transition-all duration-200 flex flex-col border border-gray-300 dark:border-gray-800 overflow-hidden">
      <a
        href="#"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex flex-row items-center gap-2 transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${isExpanded ? " p-2 px-4" : "p-2"}`}
      >
        <div
          className={`text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md  ${isExpanded ? "w-5 h-5 border-transparent bg-transparent" : "w-10 h-10 p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"}`}
        >
          {icon}
        </div>
        <div className="flex flex-row w-full justify-between items-center">
          {head}
        </div>
      </a>
      {isExpanded && (
        <hr className="border-t border-gray-300 dark:border-gray-700" />
      )}
      <div
        className={`transition-all duration-100 text-gray-900 dark:text-white ${isExpanded ? "mt-4 animate-show px-4 pb-4" : "pointer-events-none animate-hide"}`}
      >
        {children}
      </div>
    </div>
  );
}
