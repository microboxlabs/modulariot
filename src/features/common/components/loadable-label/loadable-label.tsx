import React from "react";

export default function LoadableLabel({
  label,
  value,
  isLoading = false,
  icon,
}: {
  readonly label: string;
  readonly value: string | React.ReactNode;
  readonly isLoading?: boolean;
  readonly icon?: React.ReactNode;
}) {
  return (
    <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap flex flex-row items-center text-sm font-light w-full">
      {icon && (
        <div className="flex items-center mr-1 text-gray-400">{icon}</div>
      )}
      <span>{label}</span>
      <span className="mr-1">:</span>
      {isLoading ? (
        <div className="bg-gray-500 text-gray-500 animate-pulse whitespace-nowrap rounded-full flex-grow w-full">
          Loading...
        </div>
      ) : (
        <span className="text-gray-800 dark:text-gray-200 flex-grow whitespace-normal font-normal">
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
