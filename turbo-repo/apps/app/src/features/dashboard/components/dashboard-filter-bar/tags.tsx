"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { HiTag, HiX } from "react-icons/hi";

const EXCLUDED_PARAMS = new Set(["view", "titleLabel", "icon"]);

interface TagsProps {
  searchParams: URLSearchParams;
  onRemoveParam: (key: string) => void;
  filters?: Array<{
    key: string;
    label: string;
    type: string;
  }>;
}

export default function Tags({
  searchParams,
  onRemoveParam,
  filters,
}: Readonly<TagsProps>) {
  const [filterOpen, setFilterOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });

  const tags = useMemo(() => {
    return Array.from(searchParams.entries())
      .filter(([key]) => !EXCLUDED_PARAMS.has(key))
      .map(([key, value]) => {
        const matchedFilter = filters?.find((f) => f.key === key);
        return {
          name: key,
          value,
          label: matchedFilter?.label || key,
        };
      });
  }, [searchParams, filters]);

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

  if (tags.length === 0) return null;

  return (
    <div className="relative z-[1] shrink-0 overflow-visible">
      <button
        ref={buttonRef}
        type="button"
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
      </button>
      {filterOpen &&
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
            {tags.map((tag) => (
              <div
                key={tag.name}
                className="flex w-fit gap-1 whitespace-nowrap rounded-lg border border-gray-300 bg-gray-100 px-2 py-1 text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-300"
              >
                <button
                  type="button"
                  aria-label={`Remove ${tag.label}`}
                  className="cursor-pointer rounded-full bg-gray-200 text-gray-500 transition-all duration-300 hover:bg-gray-300 hover:text-gray-700 dark:bg-gray-500 dark:text-gray-300 dark:hover:bg-gray-300 dark:hover:text-gray-700"
                  onClick={() => {
                    onRemoveParam(tag.name);
                    if (tags.length <= 1) {
                      setFilterOpen(false);
                    }
                  }}
                >
                  <HiX size={20} />
                </button>
                <label className="font-normal">{tag.label}:</label>{" "}
                {tag.value}
              </div>
            ))}
          </div>,
          document.body
        )}
      <div className="absolute right-[-0.625rem] top-[-0.625rem] z-50 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-sm font-light whitespace-nowrap text-gray-500 dark:text-gray-300">
        {tags.length}
      </div>
    </div>
  );
}
