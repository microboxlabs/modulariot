"use client";

import { useState, type FC } from "react";
import { twMerge } from "tailwind-merge";

/** An inline field for renaming a thread. Enter or leaving the field saves,
 * Escape cancels; an empty or unchanged value saves nothing. */
export const TitleInput: FC<{
  initial: string;
  label: string;
  onSubmit: (title: string) => void;
  onDone: () => void;
  className?: string;
}> = ({ initial, label, onSubmit, onDone, className }) => {
  const [value, setValue] = useState(initial);
  const [finished, setFinished] = useState(false);

  const finish = (save: boolean) => {
    if (finished) return;
    setFinished(true);
    const title = value.trim();
    if (save && title && title !== initial) onSubmit(title);
    onDone();
  };

  return (
    <input
      autoFocus
      value={value}
      maxLength={280}
      aria-label={label}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      onClick={(e) => e.stopPropagation()}
      className={twMerge(
        "min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-800 outline-none focus:border-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100",
        className
      )}
    />
  );
};
