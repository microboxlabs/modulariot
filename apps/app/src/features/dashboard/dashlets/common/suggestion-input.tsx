"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { TextInput } from "flowbite-react";
import { useDropdown } from "./use-dropdown";
import { DropdownList } from "./dropdown-list";

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

  const handleSelect = useCallback(
    (suggestion: string) => {
      onChange(suggestion);
      setIsOpen(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onChange]
  );

  const close = useCallback(() => setIsOpen(false), []);

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useDropdown({
    items: filtered,
    isOpen,
    onClose: close,
    onSelect: handleSelect,
    containerRef,
    dropdownRef,
  });

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
        <DropdownList
          items={filtered}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          onHover={setSelectedIndex}
          dropdownRef={dropdownRef}
          getKey={(s) => s}
          renderItem={(s) => s}
        />
      )}
    </div>
  );
}
