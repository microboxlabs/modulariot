"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useDropdown } from "./use-dropdown";

// ============================================================================
// Types
// ============================================================================

interface UseHbAutocompleteOptions {
  value: string;
  onChange: (value: string) => void;
  /** Handlebars prefix to detect, e.g. "row" for {{row.}} or "filter" for {{filter.}} */
  prefix: string;
  suggestions?: string[];
}

export interface HbAutocompleteResult {
  isOpen: boolean;
  filtered: string[];
  selectedIndex: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  dropdownRef: React.RefObject<HTMLUListElement | null>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClick: () => void;
  handleKeyDownCombined: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSelect: (key: string) => void;
  setSelectedIndex: (index: number) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Shared autocomplete logic for Handlebars-aware inputs.
 * Detects `{{<prefix>.` expressions and shows filtered suggestions.
 */
export function useHbAutocomplete({
  value,
  onChange,
  prefix,
  suggestions,
}: UseHbAutocompleteOptions): HbAutocompleteResult {
  const [isOpen, setIsOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState(value.length);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const prefixPattern = useMemo(() => new RegExp(String.raw`\{\{${prefix}\.(\w*)$`), [prefix]);
  const replacePattern = useMemo(() => new RegExp(String.raw`\{\{${prefix}\.\w*$`), [prefix]);

  const detectPrefix = useCallback(
    (text: string, cursor: number): string | null => {
      const before = text.slice(0, cursor);
      const match = prefixPattern.exec(before);
      return match ? match[1] : null;
    },
    [prefixPattern],
  );

  const partial = useMemo(
    () => (suggestions?.length ? detectPrefix(value, cursorPos) : null),
    [value, cursorPos, suggestions, detectPrefix],
  );

  const filtered = useMemo(() => {
    if (partial === null || !suggestions?.length) return [];
    const lower = partial.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lower));
  }, [partial, suggestions]);

  const handleSelect = useCallback(
    (key: string) => {
      const before = value.slice(0, cursorPos);
      const after = value.slice(cursorPos);
      const prefixMatch = replacePattern.exec(before);
      if (prefixMatch) {
        const start = prefixMatch.index;
        const newValue = `${before.slice(0, start)}{{${prefix}.${key}}}${after}`;
        onChange(newValue);
        const newCursor = start + `{{${prefix}.${key}}}`.length;
        setCursorPos(newCursor);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.setSelectionRange(newCursor, newCursor);
        }, 0);
      }
      setIsOpen(false);
    },
    [value, cursorPos, onChange, prefix, replacePattern],
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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const newCursor = e.target.selectionStart ?? newValue.length;
      onChange(newValue);
      setCursorPos(newCursor);

      if (suggestions?.length) {
        const p = detectPrefix(newValue, newCursor);
        if (p === null) {
          setIsOpen(false);
        } else {
          setIsOpen(true);
          setSelectedIndex(0);
        }
      }
    },
    [onChange, suggestions, detectPrefix, setSelectedIndex],
  );

  const handleKeyDownCombined = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isOpen && filtered.length > 0) {
        handleKeyDown(e);
      }
    },
    [isOpen, filtered, handleKeyDown],
  );

  const handleClick = useCallback(() => {
    const pos = inputRef.current?.selectionStart ?? value.length;
    setCursorPos(pos);
    if (suggestions?.length) {
      const p = detectPrefix(value, pos);
      if (p !== null) {
        setIsOpen(true);
        setSelectedIndex(0);
      }
    }
  }, [value, suggestions, detectPrefix, setSelectedIndex]);

  return {
    isOpen: isOpen && filtered.length > 0,
    filtered,
    selectedIndex,
    containerRef,
    inputRef,
    dropdownRef,
    handleChange,
    handleClick,
    handleKeyDownCombined,
    handleSelect,
    setSelectedIndex,
  };
}
