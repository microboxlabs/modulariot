import React from "react";

export type ConnectorType = "dots" | "dashes" | "line" | "none";

export default function LoadableLabel({
  label,
  value,
  isLoading = false,
  icon,
  className = "",
  showEquals = true,
  justifyBetween = false,
  connector = "none",
}: {
  readonly label: string;
  readonly value: string | React.ReactNode;
  readonly isLoading?: boolean;
  readonly icon?: React.ReactNode;
  readonly className?: string;
  readonly showEquals?: boolean; // New prop to control whether to show ":" or "="
  readonly justifyBetween?: boolean; // Add justify-between between label and value
  readonly connector?: ConnectorType; // Visual connector between label and value
}) {
  const connectorStyles: Record<ConnectorType, string> = {
    dots: "border-b-2 border-dotted border-gray-300 dark:border-gray-600",
    dashes: "border-b-2 border-dashed border-gray-300 dark:border-gray-600",
    line: "border-b border-solid border-gray-300 dark:border-gray-600",
    none: "",
  };

  const hasConnector = connector !== "none";

  return (
    <span
      className={
        "text-gray-600 dark:text-gray-400 whitespace-nowrap flex flex-row items-center text-sm font-light w-full " +
        (justifyBetween || hasConnector ? "justify-between " : "") +
        className
      }
    >
      <span className="flex items-center shrink-0">
        {icon && (
          <span className="flex items-center mr-1 text-gray-400">{icon}</span>
        )}
        <span>{label}</span>
        {showEquals && !hasConnector && <span className="mr-1">:</span>}
      </span>
      {hasConnector && (
        <span className={`flex-grow mx-2 h-0 self-end mb-1 ${connectorStyles[connector]}`} />
      )}
      {isLoading ? (
        <div className="bg-gray-500 text-gray-500 animate-pulse whitespace-nowrap rounded-full flex-grow w-full">
          Loading...
        </div>
      ) : (
        <span className={`text-gray-800 dark:text-gray-200 text-left whitespace-normal font-normal shrink-0 ${justifyBetween || hasConnector ? "" : "flex-grow"}`}>
          {value}
        </span>
      )}
    </span>
  );
}

{
  /* <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap flex flex-row text-sm font-light w-full">
      {label}
      <span className="mr-1">:</span>
      {isLoading ? (
        <div className="bg-gray-500 text-gray-500 animate-pulse whitespace-nowrap rounded-full flex-grow w-full">
          Loading...
        </div>
      ) : (
        <span className="text-gray-800 dark:text-gray-200 flex-grow whitespace-normal">
          {value}
        </span>
      )}
    </span> */
}
