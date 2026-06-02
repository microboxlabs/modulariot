"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useDropdown } from "./use-dropdown";

// ============================================================================
// Types
// ============================================================================

interface UseHbAutocompleteOptions {
  value: string;
  onChange: (value: string) => void;
  /** Handlebars prefix to detect, e.g. "row" for {{row.}} */
  prefix: string;
  suggestions?: string[];
}

export interface HbAutocompleteResult {
  isOpen: boolean;
  /** True when {{ is detected but there are no suggestions to show */
  hasNoSuggestions: boolean;
  filtered: string[];
  selectedIndex: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  dropdownRef: React.RefObject<HTMLUListElement | null>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleClick: () => void;
  handleKeyDownCombined: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelect: (key: string) => void;
  setSelectedIndex: (index: number) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Shared autocomplete logic for Handlebars-aware inputs and textareas.
 *
 * Triggers on `{{` (bare opening) to show all suggestions, and on
 * `{{<prefix>.<partial>` to show filtered suggestions.
 * Selecting a suggestion always inserts the full `{{prefix.key}}` token.
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
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const prefixPattern = useMemo(
    () => new RegExp(String.raw`\{\{${prefix}\.([a-z0-9_-]*)$`, "i"),
    [prefix]
  );

  /**
   * Returns the partial typed after `{{prefix.` (for filtering),
   * an empty string when a bare `{{` is open (show all),
   * or null when there's no open HB expression.
   */
  const detectOpen = useCallback(
    (text: string, cursor: number): string | null => {
      const before = text.slice(0, cursor);

      // Case 1: {{prefix.partial → return partial (may be "")
      const prefixMatch = prefixPattern.exec(before);
      if (prefixMatch) return prefixMatch[1];

      // Case 2: bare {{ with no closing }} yet → show all
      if (/\{\{[^{}]*$/.test(before)) return "";

      return null;
    },
    [prefixPattern]
  );

  // Always detect {{ — regardless of whether suggestions exist
  const partial = useMemo(
    () => detectOpen(value, cursorPos),
    [value, cursorPos, detectOpen]
  );

  // partial === null  → not in a HB expression
  // partial === ""    → bare {{, show all suggestions
  // partial === "co"  → {{prefix.co, filter to matches
  const filtered = useMemo(() => {
    if (partial === null || !suggestions?.length) return [];
    if (partial === "") return suggestions;
    const lower = partial.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lower));
  }, [partial, suggestions]);

  // True when {{ is open but there's nothing to suggest yet
  const hasNoSuggestions = partial !== null && !suggestions?.length;

  // Always replace from the last `{{` backward so bare {{ and {{row.partial
  // both get replaced cleanly with {{prefix.key}}.
  const handleSelect = useCallback(
    (key: string) => {
      const before = value.slice(0, cursorPos);
      const after = value.slice(cursorPos);
      const openIdx = before.lastIndexOf("{{");
      if (openIdx !== -1) {
        const inserted = `{{${prefix}.${key}}}`;
        const newValue = `${before.slice(0, openIdx)}${inserted}${after}`;
        onChange(newValue);
        const newCursor = openIdx + inserted.length;
        setCursorPos(newCursor);
        setTimeout(() => {
          const el = inputRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(newCursor, newCursor);
          }
        }, 0);
      }
      setIsOpen(false);
    },
    [value, cursorPos, onChange, prefix]
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
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursor = e.target.selectionStart ?? newValue.length;
      onChange(newValue);
      setCursorPos(newCursor);

      const p = detectOpen(newValue, newCursor);
      if (p === null) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
        setSelectedIndex(0);
      }
    },
    [onChange, detectOpen, setSelectedIndex]
  );

  const handleKeyDownCombined = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (isOpen && filtered.length > 0) {
        handleKeyDown(e as React.KeyboardEvent<HTMLInputElement>);
      }
    },
    [isOpen, filtered, handleKeyDown]
  );

  const handleClick = useCallback(() => {
    const el = inputRef.current;
    const pos = el?.selectionStart ?? value.length;
    setCursorPos(pos);
    const p = detectOpen(value, pos);
    if (p !== null) {
      setIsOpen(true);
      setSelectedIndex(0);
    }
  }, [value, detectOpen, setSelectedIndex]);

  return {
    isOpen: isOpen && (filtered.length > 0 || hasNoSuggestions),
    hasNoSuggestions,
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
