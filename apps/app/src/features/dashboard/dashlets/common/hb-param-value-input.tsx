"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { TextInput } from "flowbite-react";
import { getHandlebarsStatus, getFlowbiteColor } from "./handlebars-helpers";
import { useDropdown } from "./use-dropdown";
import { DropdownList } from "./dropdown-list";

// ============================================================================
// Types
// ============================================================================

interface HbParamValueInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Filter keys available for {{filter.*}} autocomplete */
  filterSuggestions?: string[];
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Detect if the cursor is inside an open `{{filter.` expression. */
function detectFilterPrefix(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const match = /\{\{filter\.(\w*)$/.exec(before);
  return match ? match[1] : null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Compact TextInput with Handlebars validation and {{filter.*}} autocomplete.
 * Uses a portal to render the dropdown outside overflow-hidden containers.
 */
export function HbParamValueInput({
  value,
  onChange,
  placeholder,
  filterSuggestions,
  className,
}: Readonly<HbParamValueInputProps>) {
  const status = useMemo(() => getHandlebarsStatus(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState(value.length);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const partial = useMemo(
    () => (filterSuggestions?.length ? detectFilterPrefix(value, cursorPos) : null),
    [value, cursorPos, filterSuggestions],
  );

  const filtered = useMemo(() => {
    if (partial === null || !filterSuggestions?.length) return [];
    const lower = partial.toLowerCase();
    return filterSuggestions.filter((s) => s.toLowerCase().includes(lower));
  }, [partial, filterSuggestions]);

  // Update dropdown position when open
  useEffect(() => {
    if (!isOpen || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [isOpen, filtered]);

  const handleSelect = useCallback(
    (key: string) => {
      const before = value.slice(0, cursorPos);
      const after = value.slice(cursorPos);
      const prefixMatch = /\{\{filter\.\w*$/.exec(before);
      if (prefixMatch) {
        const start = prefixMatch.index;
        const newValue = `${before.slice(0, start)}{{filter.${key}}}${after}`;
        onChange(newValue);
        const newCursor = start + `{{filter.${key}}}`.length;
        setCursorPos(newCursor);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.setSelectionRange(newCursor, newCursor);
        }, 0);
      }
      setIsOpen(false);
    },
    [value, cursorPos, onChange],
  );

  const close = useCallback(() => setIsOpen(false), []);

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useDropdown({
    items: filtered,
    isOpen: isOpen && filtered.length > 0,
    onClose: close,
    onSelect: handleSelect,
    containerRef,
    dropdownRef,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newCursor = e.target.selectionStart ?? newValue.length;
    onChange(newValue);
    setCursorPos(newCursor);

    if (filterSuggestions?.length) {
      const p = detectFilterPrefix(newValue, newCursor);
      if (p === null) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
        setSelectedIndex(0);
      }
    }
  };

  const handleKeyDownCombined = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isOpen && filtered.length > 0) {
      handleKeyDown(e);
    }
  };

  const handleClick = () => {
    const pos = inputRef.current?.selectionStart ?? value.length;
    setCursorPos(pos);
    if (filterSuggestions?.length) {
      const p = detectFilterPrefix(value, pos);
      if (p !== null) {
        setIsOpen(true);
        setSelectedIndex(0);
      }
    }
  };

  const showDropdown = isOpen && filtered.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <TextInput
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onClick={handleClick}
        onKeyDown={handleKeyDownCombined}
        placeholder={placeholder}
        sizing="sm"
        color={getFlowbiteColor(status)}
        autoComplete="off"
      />
      {showDropdown &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
          >
            <DropdownList
              items={filtered}
              selectedIndex={selectedIndex}
              onSelect={handleSelect}
              onHover={setSelectedIndex}
              dropdownRef={dropdownRef}
              getKey={(s) => s}
              renderItem={(s) => (
                <span className="font-mono text-xs">
                  {"{{filter."}
                  <span className="font-semibold">{s}</span>
                  {"}}"}
                </span>
              )}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
