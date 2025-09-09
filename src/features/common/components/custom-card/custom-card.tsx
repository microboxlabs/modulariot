import React, { FC, SVGProps } from "react";
import { Badge } from "flowbite-react";

export interface InformationBadge {
  text: string;
  color?:
    | "blue"
    | "gray"
    | "red"
    | "green"
    | "yellow"
    | "purple"
    | "pink"
    | "indigo";
  icon?: FC<SVGProps<SVGSVGElement>>;
}

export default function CustomCard({
  children,
  title,
  subtitle,
  badges,
}: {
  children: React.ReactNode;
  title: string | null;
  subtitle: string | null;
  badges?: InformationBadge[];
}) {
  return (
    <div
      className={`w-full h-full flex flex-col ${
        title == null && subtitle == null ? "gap-0" : "gap-2"
      } p-2`}
    >
      <div className="inline flex-shrink-0">
        {title && (
          <div className="flex flex-row justify-between items-center h-7">
            <p className="text-md font-normal text-gray-700 dark:text-gray-300 whitespace-normal md:whitespace-nowrap">
              {title}
            </p>
            {badges && badges.length > 0 && (
              <div className="flex flex-row gap-1 flex-wrap">
                {badges.map((badge, index) => (
                  <Badge
                    className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5"
                    /* className="inline-flex items-center px-2 py-1 me-2 text-sm font-medium text-gray-800 bg-gray-100 rounded-sm dark:bg-gray-700 dark:text-gray-300" */
                    key={badge.text + index}
                    color={badge.color || "gray"}
                    icon={badge.icon}
                    size="sm"
                  >
                    {badge.text}
                  </Badge>
                ))}
              </div>
            )}
          </div>
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
