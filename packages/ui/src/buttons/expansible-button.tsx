// This button has the capacity of expanding displaying information set as a child
// but if its not expanded it only shows a button with an icon and a label

"use client";
import React, { useState } from "react";
interface ExpandableButtonProps {
    initial_state?: boolean;
    icon: React.ReactElement;
    title: string;
    description: string;
    children: React.ReactNode;
    withBorder?: boolean;
}

export default function ExpandableButton({
    initial_state = false,
    icon,
    title,
    children,
    description,
    withBorder = false,
}: ExpandableButtonProps) {
    const [isExpanded, setIsExpanded] = useState(initial_state);
    console.log(isExpanded)


    return (
        <div
        className={`${withBorder ? "border border-gray-300 dark:border-gray-600" : ""} rounded-md transition-all duration-200 flex flex-col overflow-hidden`}
        >
            {/* Title */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex flex-row items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 hover:cursor-pointer transition-all duration-200 p-4"
            >
                <div
                className={`text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md  ${isExpanded ? "w-5 h-5 border-transparent bg-transparent" : "w-10 h-10 p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900"}`}
                >
                {icon}
                </div>
                <div className="flex flex-col">
                <h1 className="text-md font-bold text-slate-900 dark:text-white">
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
                className={`grid transition-all duration-300 text-gray-900 dark:text-white ${
                    isExpanded
                        ? "grid-rows-[1fr] opacity-100 p-4"
                        : "grid-rows-[0fr] opacity-0 pointer-events-none"
                }`}
            >
                <div className="overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}