"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TextInput } from "flowbite-react";
import { twMerge } from "tailwind-merge";

interface SuggestionInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  sizing?: "sm" | "md";
  color?: "gray" | "success" | "failure";
}

export function SuggestionInput({
  value,
  onChange,
  suggestions,
  placeholder,
  sizing = "sm",
  color = "gray",
}: Readonly<SuggestionInputProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  // Hide suggestions when input contains handlebars expression
  const hasHandlebars = value.includes("{{");

  const filtered = useMemo(() => {
    if (hasHandlebars) return [];
    if (!value) return suggestions;
    const lower = value.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lower));
  }, [suggestions, value, hasHandlebars]);

  // Click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const item = dropdownRef.current.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen]);

  const handleSelect = useCallback(
    (suggestion: string) => {
      onChange(suggestion);
      setIsOpen(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || filtered.length === 0) {
        if (e.key === "Escape") {
          setIsOpen(false);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
        case "Tab":
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex]);
          }
          break;
      }
    },
    [isOpen, filtered, selectedIndex, handleSelect]
  );

  const handleFocus = () => {
    if (!hasHandlebars && filtered.length > 0) {
      setIsOpen(true);
      setSelectedIndex(0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    if (newValue.includes("{{")) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
      setSelectedIndex(0);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <TextInput
        ref={inputRef}
        sizing={sizing}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        color={color}
      />
      {isOpen && filtered.length > 0 && (
        <ul
          ref={dropdownRef}
          className={twMerge(
            "absolute z-50 w-full mt-1",
            "bg-white dark:bg-gray-800",
            "border border-gray-200 dark:border-gray-700",
            "rounded-lg shadow-lg",
            "max-h-48 overflow-y-auto",
            "py-1"
          )}
        >
          {filtered.map((suggestion, index) => (
            <li key={suggestion}>
              <button
                type="button"
                tabIndex={index === selectedIndex ? 0 : -1}
                onClick={() => handleSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={twMerge(
                  "w-full text-left px-3 py-1.5 text-sm cursor-pointer",
                  "transition-colors border-0 bg-transparent",
                  index === selectedIndex
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700",
                  "text-gray-900 dark:text-white"
                )}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
