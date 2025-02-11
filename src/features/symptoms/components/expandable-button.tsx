"use client";
import { useState } from "react";
import React from "react";
interface ExpandableButtonProps {
  icon: React.ReactElement;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function ExpandableButton({ icon, title, children, description }: ExpandableButtonProps) {

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div onClick={() => setIsExpanded(!isExpanded)} className={`hover:cursor-pointer rounded-md transition-all duration-200 flex flex-col ${isExpanded ? "bg-gray-100 p-4 hover:bg-gray-100" : "hover:bg-gray-100 p-2"}`}>
      {/* Title */}
      <div className={`flex flex-row items-center gap-2`}>
        {React.cloneElement(icon, { className: `transition-all duration-200 bg-white border rounded-md border-gray-300 ${isExpanded ? " w-9 h-9 px-2" : "w-10 h-10 p-2 "}` })}
        <div className="flex flex-col">
          <h1 className="text-md font-bold">{title}</h1>
          <p className={`text-sm text-gray-500 overflow-hidden transition-all duration-200 ${isExpanded ? "max-h-0 opacity-0" : "max-h-10 opacity-100"}`}>
            {description}
          </p>
        </div>
      </div>
      {/* Content */}
      <div className={`transition-all duration-200 ${isExpanded ? "max-h-[500px] opacity-100 mt-4" : "pointer-events-none max-h-0 opacity-0"}`}>
        {children}
      </div>
    </div >
  );
}
