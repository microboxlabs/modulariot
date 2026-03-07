"use client";

import { useState, useEffect, useCallback, type RefObject } from "react";

interface UseDropdownOptions<T> {
  items: T[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: T) => void;
  containerRef: RefObject<HTMLElement | null>;
  dropdownRef: RefObject<HTMLElement | null>;
}

export function useDropdown<T>({
  items,
  isOpen,
  onClose,
  onSelect,
  containerRef,
  dropdownRef,
}: UseDropdownOptions<T>) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, containerRef, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const item = dropdownRef.current.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen, dropdownRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || items.length === 0) {
        if (e.key === "Escape") {
          onClose();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < items.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "Tab":
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex]);
          }
          break;
      }
    },
    [isOpen, items, selectedIndex, onSelect, onClose]
  );

  return { selectedIndex, setSelectedIndex, handleKeyDown };
}
