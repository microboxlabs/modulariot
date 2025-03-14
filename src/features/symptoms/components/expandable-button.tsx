"use client";
import React, { useState } from "react";
interface ExpandableButtonProps {
  initial_state?: boolean;
  icon: React.ReactElement;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function ExpandableButton({
  initial_state = false,
  icon,
  title,
  children,
  description,
}: ExpandableButtonProps) {
  const [isExpanded, setIsExpanded] = useState(initial_state);

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className={`hover:cursor-pointer rounded-md transition-all duration-200 flex flex-col ${isExpanded ? " p-4 dark:hover:bg-gray-700 hover:bg-gray-100" : "dark:hover:bg-gray-700 hover:bg-gray-100 p-2"}`}
    >
      {/* Title */}
      <div className="flex flex-row items-center gap-2">
        <div
          className={`flex items-center justify-center transition-all duration-200  rounded-md  ${isExpanded ? "w-5 h-5 border-transparent bg-transparent" : "w-10 h-10 p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"}`}
        >
          {icon}
        </div>
        <div className="flex flex-col">
          <h1 className="text-md font-bold text-gray-900 dark:text-white">
            {title}
          </h1>
          <p
            className={`text-sm text-gray-500 overflow-hidden transition-all duration-100 ${isExpanded ? "max-h-0 opacity-0" : "max-h-10 opacity-100"}`}
          >
            {description}
          </p>
        </div>
      </div>
      {/* Content */}
      <div
        className={`transition-all duration-100 text-gray-900 dark:text-white ${isExpanded ? "mt-4 animate-show" : "pointer-events-none animate-hide"}`}
      >
        {children}
      </div>
    </div>
  );
}
