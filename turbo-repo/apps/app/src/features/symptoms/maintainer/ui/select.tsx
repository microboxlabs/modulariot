import type { SelectHTMLAttributes } from "react";
import { HiChevronDown } from "react-icons/hi";
import { twMerge } from "tailwind-merge";

/**
 * A native select drawn like the field combobox: the browser's arrow hidden
 * and a chevron 8px from the right edge. `className` styles the select;
 * `wrapperClassName` sizes it in its row (flex-1, min-w-40, w-full).
 */
export default function Select({
  className,
  wrapperClassName,
  ...props
}: Readonly<
  SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }
>) {
  return (
    <span className={twMerge("relative inline-flex", wrapperClassName)}>
      <select
        {...props}
        className={twMerge(className, "w-full appearance-none pr-7")}
      />
      <HiChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-gray-400"
      />
    </span>
  );
}
