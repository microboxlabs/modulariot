"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TextInput } from "flowbite-react";
import { DropdownList } from "@/features/dashboard/dashlets/common/dropdown-list";
import { useDropdown } from "@/features/dashboard/dashlets/common/use-dropdown";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type { CollectionVariable } from "./review-integration.types";

/**
 * The source field of an array row: which collection its elements come from.
 *
 * A picker of whole paths rather than the value rows' `{{namespace.field}}` autocomplete,
 * because the two rows ask different questions and the value vocabulary answers this one
 * wrongly. It offers every root a template may read — including the bind name the array
 * itself creates, so picking it aims the row at its own elements — while a bare `{{content}}`,
 * the right answer for a top-level array, cannot be typed by that machinery at all.
 */
export function ReviewCollectionInput({
  value,
  onChange,
  collections,
  placeholder,
  color = "gray",
  dict,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  /** The arrays reachable from this row's scope. Empty hides the picker, leaving free text. */
  collections: readonly CollectionVariable[];
  placeholder?: string;
  color?: "gray" | "success" | "failure";
  dict: I18nRecord;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  // Filtered on the path alone, with the braces the operator is mid-typing ignored, so
  // `{{cont` and `cont` narrow the same way.
  const items = useMemo(() => {
    const typed = value.replace(/[{}]/g, "").trim().toLowerCase();
    if (!typed) return [...collections];
    return collections.filter((collection) =>
      collection.path.toLowerCase().includes(typed)
    );
  }, [collections, value]);

  const close = useCallback(() => setIsOpen(false), []);
  const select = useCallback(
    (collection: CollectionVariable) => {
      onChange(`{{${collection.path}}}`);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [onChange]
  );

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useDropdown({
    items,
    isOpen: isOpen && items.length > 0,
    onClose: close,
    onSelect: select,
    containerRef,
    dropdownRef,
  });

  // The drawer scrolls and clips; a portal keeps the list out of its overflow.
  useEffect(() => {
    if (!isOpen || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [isOpen, items]);

  const open = useCallback(() => {
    if (collections.length === 0) return;
    setIsOpen(true);
    setSelectedIndex(0);
  }, [collections.length, setSelectedIndex]);

  return (
    <div ref={containerRef} className="relative">
      <TextInput
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          open();
        }}
        onClick={open}
        onKeyDown={(e) =>
          handleKeyDown(e as React.KeyboardEvent<HTMLInputElement>)
        }
        placeholder={placeholder}
        sizing="sm"
        color={color}
        className="font-mono [&_input]:text-xs"
        autoComplete="off"
      />
      {isOpen &&
        items.length > 0 &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              minWidth: position.width,
              zIndex: 9999,
            }}
          >
            <DropdownList
              items={items}
              selectedIndex={selectedIndex}
              onSelect={select}
              onHover={setSelectedIndex}
              dropdownRef={dropdownRef}
              getKey={(collection: CollectionVariable) => collection.path}
              renderItem={(collection: CollectionVariable) => (
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-xs">{`{{${collection.path}}}`}</span>
                  <span className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {trDynamic(collection.labelKey, dict)}
                  </span>
                </span>
              )}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
