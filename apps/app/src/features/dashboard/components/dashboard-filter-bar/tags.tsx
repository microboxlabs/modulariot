"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { HiTag, HiX } from "react-icons/hi";

interface TagItem {
  name: string;
  value: string;
  label: string;
}

interface TagsProps {
  searchParams: URLSearchParams;
  onRemoveParam: (key: string) => void;
  navegation_params?: Array<{
    label: string;
    param: { key: string; type: string };
  }>;
}

export default function Tags({
  searchParams,
  onRemoveParam,
  navegation_params,
}: TagsProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<TagItem[]>([]);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });

  // Build tags from URL search params
  useEffect(() => {
    if (searchParams) {
      const params = new URLSearchParams(searchParams.toString());
      const tags = Array.from(params.entries())
        .filter(
          ([key]) => key !== "view" && key !== "titleLabel" && key !== "icon"
        )
        .map(([key, value]) => {
          const navParam = navegation_params?.find(
            (param) => param.param.key === key
          );
          return {
            name: key,
            value,
            label: navParam?.label || key,
          };
        });
      setFilter(tags);
    }
  }, [searchParams, navegation_params]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setFilterOpen(false);
      }
    };

    if (filterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterOpen]);

  return (
    <div
      className={`relative z-[1] shrink-0 overflow-visible transition-all duration-300 ${
        filter.length > 0 ? "block scale-100" : "hidden w-0 scale-0"
      }`}
    >
      <div
        ref={buttonRef}
        className="relative flex h-[42px] w-[42px] cursor-pointer select-none items-center justify-center rounded-lg border border-gray-300 bg-gray-100 transition-all duration-300 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500"
        onClick={() => {
          if (!filterOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const dropdownWidth = 250;
            const margin = 16;

            let leftPos = rect.left;
            if (rect.left + dropdownWidth > window.innerWidth - margin) {
              leftPos = rect.right - dropdownWidth;
              if (leftPos < margin) {
                leftPos = margin;
              }
            }

            setButtonPosition({
              top: rect.bottom + 8,
              left: leftPos,
            });
          }
          setFilterOpen(!filterOpen);
        }}
      >
        <HiTag className="text-gray-500 dark:text-gray-400" />
      </div>
      {filterOpen &&
        filter.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className="z-[9999] flex flex-col gap-2 rounded-lg border border-gray-300 bg-white p-2 shadow-xl dark:border-gray-600 dark:bg-gray-700"
            style={{
              position: "fixed",
              top: buttonPosition.top,
              left: buttonPosition.left,
            }}
          >
            {filter.map((tag, index) => (
              <div
                key={index}
                className="flex w-fit gap-1 whitespace-nowrap rounded-lg border border-gray-300 bg-gray-100 px-2 py-1 text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-300"
              >
                <HiX
                  className="cursor-pointer rounded-full bg-gray-200 text-gray-500 transition-all duration-300 hover:bg-gray-300 hover:text-gray-700 dark:bg-gray-500 dark:text-gray-300 dark:hover:bg-gray-300 dark:hover:text-gray-700"
                  size={20}
                  onClick={() => {
                    onRemoveParam(tag.name);
                    // Remove from local state immediately
                    setFilter((prev) =>
                      prev.filter((t) => t.name !== tag.name)
                    );
                    if (filter.length <= 1) {
                      setFilterOpen(false);
                    }
                  }}
                />
                <label className="font-normal">{tag.label}:</label>{" "}
                {tag.value}
              </div>
            ))}
          </div>,
          document.body
        )}
      <div className="absolute right-[-0.625rem] top-[-0.625rem] z-50 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-sm font-light whitespace-nowrap text-gray-500 dark:text-gray-300">
        {filter.length}
      </div>
    </div>
  );
}
