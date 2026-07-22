"use client";

import { useState, type ComponentProps, type FC } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { motion } from "motion/react";

interface IconBarItemProps {
  icon?: FC<ComponentProps<"svg">>;
  label: string;
  translatedLabel: string;
  href?: string;
  hasChildren: boolean;
  isActive: boolean;
  isPanelOpen: boolean;
  index: number;
  onClick: () => void;
}

export default function IconBarItem({
  icon: Icon,
  label,
  translatedLabel,
  href,
  hasChildren,
  isActive,
  isPanelOpen,
  index,
  onClick,
}: Readonly<IconBarItemProps>) {
  const [isHovered, setIsHovered] = useState(false);

  const showLabel = isHovered && !isPanelOpen;

  function getIconColor(): string {
    if (isActive) return "text-gray-900 dark:text-white";
    if (isPanelOpen) return "text-gray-700 dark:text-gray-200";
    return "text-gray-500 dark:text-gray-400";
  }

  const isDirect = !hasChildren;

  const content = (
    <div
      className={twMerge(
        "relative flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
        getIconColor(),
        "hover:text-gray-700 dark:hover:text-gray-200",
        isActive && "bg-gray-100 dark:bg-gray-700",
        isPanelOpen && !isActive && "bg-gray-50 dark:bg-gray-700/50",
        isDirect && "border border-dashed border-gray-300 dark:border-gray-600",
        isDirect &&
          isActive &&
          "border-solid border-gray-400 dark:border-gray-500"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {Icon && <Icon className="h-6 w-6" />}

      {/* Expanding label — grows from the L1 border edge, text stays full-size with overflow hidden */}
      <div
        className={twMerge(
          "absolute left-full top-1/2 z-50 ml-[5px] -translate-y-1/2 overflow-hidden",
          "rounded-r-md py-1.5 text-sm font-medium",
          "bg-white text-gray-900 shadow-lg border border-l-0 border-gray-200",
          "dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700",
          "transition-[max-width,opacity] duration-100 ease-out",
          showLabel
            ? "max-w-48 opacity-100"
            : "pointer-events-none max-w-0 opacity-0"
        )}
      >
        <span className="whitespace-nowrap px-3">{translatedLabel}</span>
      </div>
    </div>
  );

  const entranceAnimation = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.3, delay: index * 0.05, ease: "easeOut" as const },
  };

  if (hasChildren) {
    return (
      <motion.li {...entranceAnimation}>
        <button
          type="button"
          aria-label={translatedLabel}
          aria-expanded={isPanelOpen}
          onClick={onClick}
          className="flex w-full items-center justify-center"
        >
          {content}
        </button>
      </motion.li>
    );
  }

  return (
    <motion.li {...entranceAnimation}>
      <Link
        href={href ?? "#"}
        aria-label={translatedLabel}
        onClick={onClick}
        className="flex w-full items-center justify-center"
      >
        {content}
      </Link>
    </motion.li>
  );
}
