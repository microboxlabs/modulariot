import type { SelectHTMLAttributes } from "react";
import { HiChevronDown } from "react-icons/hi";
import { twMerge } from "tailwind-merge";

/**
 * A native select drawn like the field combobox: the browser's arrow hidden
 * and a chevron 8px from the right edge. `className` styles the select;
 * `wrapperClassName` sizes it in its row (flex-1, min-w-40, w-full).
 * `inline` is for a select without a border inside a padded pill: the
 * chevron sits at the select's right edge, so the pill's padding is the
 * only space after it.
 */
export default function Select({
  className,
  wrapperClassName,
  inline = false,
  ...props
}: Readonly<
  SelectHTMLAttributes<HTMLSelectElement> & {
    wrapperClassName?: string;
    inline?: boolean;
  }
>) {
  return (
    <span className={twMerge("relative inline-flex", wrapperClassName)}>
      <select
        {...props}
        className={twMerge(
          className,
          "w-full appearance-none",
          inline ? "pr-5" : "pr-7"
        )}
      />
      <HiChevronDown
        aria-hidden
        className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${inline ? "right-0" : "right-2"}`}
      />
    </span>
  );
}
