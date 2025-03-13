import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Conditions } from "./table-item.type";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
export default function ConditionIcon({
  condition,
  size = "h-10 w-10",
  dict,
}: {
  condition: string;
  size?: string;
  dict: I18nRecord;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const updateTooltipPosition = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const rect_width = rect.width / 2;
      setTooltipPosition({
        top: rect.top - 32, // 32px above the icon
        left: rect.left + rect_width,
      });
    }
  };

  useEffect(() => {
    if (showTooltip) {
      updateTooltipPosition();
      window.addEventListener("scroll", updateTooltipPosition);
      window.addEventListener("resize", updateTooltipPosition);
    }

    return () => {
      window.removeEventListener("scroll", updateTooltipPosition);
      window.removeEventListener("resize", updateTooltipPosition);
    };
  }, [showTooltip]);

  return (
    <div className="relative">
      <div
        ref={iconRef}
        className={`${size} display-flex justify-center items-center ${Conditions[condition as keyof typeof Conditions]?.innerColor} ${Conditions[condition as keyof typeof Conditions]?.color} border-2 rounded-full cursor-pointer`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Image
          src={Conditions[condition as keyof typeof Conditions]?.icon}
          alt={condition}
          width={100}
          height={100}
        />
      </div>
      {showTooltip &&
        createPortal(
          <div
            className="fixed z-50 px-2 py-1 text-sm text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-600 rounded-md whitespace-nowrap border border-gray-500 dark:border-gray-400"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              transform: "translateX(-50%)",
            }}
          >
            {(
              (dict.symptoms as I18nRecord)[
                Conditions[condition as keyof typeof Conditions].dict_name
              ] as string
            )
              .charAt(0)
              .toUpperCase() +
              (
                (dict.symptoms as I18nRecord)[
                  Conditions[condition as keyof typeof Conditions].dict_name
                ] as string
              )
                .slice(1)
                .toLowerCase()}
            <div className="absolute w-2 h-2 bg-white dark:bg-gray-600 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2 border-r border-b border-gray-500 dark:border-gray-400"></div>
          </div>,
          document.body,
        )}
    </div>
  );
}
