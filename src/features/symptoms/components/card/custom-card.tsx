import React from "react";
import { twMerge } from "tailwind-merge";
export default function CustomCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={twMerge(
        " flex w-full flex-row lg:flex-col h-fit rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-2 gap-1",
        className,
      )}
    >
      {children}
    </div>
  );
}
