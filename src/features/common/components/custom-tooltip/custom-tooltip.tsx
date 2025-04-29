import { Tooltip } from "flowbite-react";
import React from "react";

export default function CustomTooltip({
  children,
  content,
  placement = "bottom",
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  placement?: "bottom" | "top" | "left" | "right";
}) {
  return (
    <Tooltip
      placement={placement}
      style="auto"
      theme={{
        target: "w-full h-full",
        arrow: {
          base: "absolute h-2 w-2 rotate-45",
          style: {
            auto: `bg-white dark:bg-gray-600 border-l border-t border-gray-500 dark:border-gray-400`,
          },
          placement: "-4px",
        },
        base: "absolute inline-block rounded-lg text-sm font-medium shadow-sm",
        style: {
          auto: "border border border-gray-500 dark:border-gray-400 bg-white text-gray-900 dark:bg-gray-700 dark:text-white",
        },
        content: "relative z-50",
      }}
      content={content}
    >
      {children}
    </Tooltip>
  );
}
