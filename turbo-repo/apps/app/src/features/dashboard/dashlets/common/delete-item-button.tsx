"use client";

import { HiTrash } from "react-icons/hi2";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

interface DeleteItemButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Reusable delete button for removing items from lists.
 * Used across dashlet settings for consistent styling and behavior.
 */
export function DeleteItemButton({
  onClick,
  ariaLabel = "Delete item",
  size = "md",
  className = "",
}: Readonly<DeleteItemButtonProps>) {
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={stopPropagation}
      className={`no-drag cursor-pointer shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 ${className}`}
    >
      <HiTrash className={iconSize} />
    </button>
  );
}
