"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { HiChevronDown } from "react-icons/hi";

type Options = {
  value: string;
  label: string;
};

export default function CustomSelector({
  options,
  onChange,
  base_value,
}: {
  options: Options[];
  onChange: (value: string) => void;
  base_value?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(
    base_value ? options.findIndex((option) => option.value === base_value) : 0
  );
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4, // 4px for mt-1
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [open]);

  const dropdownContent = open ? (
    <div
      ref={dropdownRef}
      data-dropdown-portal="true"
      className="fixed bg-white rounded-md border border-gray-400 flex flex-col z-50 overflow-hidden"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
    >
      {options.map((option, index) => (
        <a
          key={option.value}
          href="#"
          className="w-full p-2 hover:bg-gray-200 text-gray-700 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 cursor-pointer select-none font-light text-sm no-underline block"
          onClick={(e) => {
            e.preventDefault();
            setSelected(index);
            onChange(option.value);
            setOpen(false);
          }}
        >
          {option.label}
        </a>
      ))}
    </div>
  ) : null;

  return (
    <>
      <div className="relative inline-block text-left select-none w-full">
        <a
          ref={triggerRef}
          href="#"
          className="p-2 bg-white dark:bg-gray-700 rounded-md border border-gray-400 w-full justify-between flex items-center cursor-pointer no-underline"
          onClick={(e) => {
            e.preventDefault();
            setOpen(!open);
          }}
        >
          {options[selected].label}
          <HiChevronDown
            className={`w-4 h-4 inline-block ml-2 transition-transform duration-200 ${open ? "transform rotate-180" : ""}`}
          />
        </a>
      </div>
      {typeof window !== "undefined" &&
        createPortal(dropdownContent, document.body)}
    </>
  );
}
