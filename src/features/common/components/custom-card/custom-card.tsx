import React from "react";

export default function CustomCard({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string | null;
  subtitle: string | null;
}) {
  return (
    <div
      className={`w-full h-full flex flex-col ${
        title == null && subtitle == null ? "gap-0" : "gap-2"
      } p-2`}
    >
      <div className="inline flex-shrink-0">
        {title && (
          <p className="text-md font-normal text-gray-700 dark:text-gray-300 flex flex-row gap-2 whitespace-normal md:whitespace-nowrap items-center h-7 ">
            {title}
          </p>
        )}
        {subtitle && (
          <p className="text-sm font-normal text-gray-500 dark:text-gray-400 w-fit">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
