"use client";

import { useState } from "react";

type DismissibleTooltipProps = {
  children: React.ReactNode;
  content: React.ReactNode;
  visible: boolean;
  arrowAlign?: "left" | "center" | "right";
  className?: string;
};

export default function DismissibleTooltip({
  children,
  content,
  visible,
  arrowAlign = "right",
  className = "",
}: Readonly<DismissibleTooltipProps>) {
  const [dismissed, setDismissed] = useState(false);
  const show = visible && !dismissed;

  const arrowPositionMap = {
    left: "left-8",
    center: "left-1/2 -translate-x-1/2",
    right: "right-8",
  };
  const arrowPositionClass = arrowPositionMap[arrowAlign];

  return (
    <div
      role="group"
      className="relative"
      onMouseEnter={() => {
        if (dismissed && visible) setDismissed(false);
      }}
    >
      {children}
      <div className="absolute top-full right-0 mt-3 z-50 w-64">
        {show && (
          <>
            <div
              className={`absolute -top-[7px] ${arrowPositionClass} w-3 h-3 rotate-45 bg-white dark:bg-gray-800 border-l border-t border-gray-300 dark:border-gray-600`}
            />
            <div
              className={`relative rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 pr-6 text-sm text-gray-700 dark:text-gray-300 shadow-lg ${className}`}
            >
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="absolute top-1 right-1 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              {content}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
