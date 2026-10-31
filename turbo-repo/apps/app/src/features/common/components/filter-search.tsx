"use client";

import { HiOutlineSearch } from "react-icons/hi";

/** A search box for the filter row, shaped like the filter chips beside it. */
export default function FilterSearch({
  value,
  onChange,
  label,
  placeholder,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}>) {
  return (
    <div className="relative w-full sm:w-80">
      <HiOutlineSearch
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
      />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-full border border-gray-300 bg-white py-1 pl-8 pr-3 text-xs leading-4 text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
      />
    </div>
  );
}
