"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useDropdown } from "./use-dropdown";

// ============================================================================
// Types
// ============================================================================

export interface HbNamespace {
  /** Handlebars prefix — e.g. "row", "filter" */
  prefix: string;
  suggestions: string[];
}

/** Item shown in the autocomplete dropdown */
export type HbDropdownItem =
  | { kind: "namespace"; prefix: string; count: number }
  | { kind: "suggestion"; prefix: string; key: string };

interface UseHbAutocompleteOptions {
  value: string;
  onChange: (value: string) => void;
  namespaces: HbNamespace[];
}

export interface HbAutocompleteResult {
  isOpen: boolean;
  /** True when {{ is detected but no items are available */
  hasNoSuggestions: boolean;
  filtered: HbDropdownItem[];
  selectedIndex: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  dropdownRef: React.RefObject<HTMLUListElement | null>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleClick: () => void;
  handleKeyDownCombined: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelect: (item: HbDropdownItem) => void;
  setSelectedIndex: (index: number) => void;
}

// ============================================================================
// Detection
// ============================================================================

type DetectResult =
  | { mode: "namespace" }
  | { mode: "suggestion"; prefix: string; partial: string }
  | { mode: "closed" };

function detectMode(text: string, cursor: number, namespaces: HbNamespace[]): DetectResult {
  const before = text.slice(0, cursor);

  for (const ns of namespaces) {
    const match = new RegExp(String.raw`\{\{${ns.prefix}\.([a-z0-9_-]*)$`, "i").exec(before);
    if (match) return { mode: "suggestion", prefix: ns.prefix, partial: match[1] };
  }

  if (/\{\{\s*$/.test(before)) return { mode: "namespace" };

  return { mode: "closed" };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Multi-namespace Handlebars autocomplete.
 *
 * Typing `{{` shows a namespace group list (e.g. "row (5)", "filter (3)").
 * Selecting a namespace inserts `{{prefix.` and drills into that namespace's suggestions.
 * Typing `{{prefix.partial` directly shows filtered suggestions for that namespace.
 */
export function useHbAutocomplete({
  value,
  onChange,
  namespaces,
}: UseHbAutocompleteOptions): HbAutocompleteResult {
  const [isOpen, setIsOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState(value.length);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const detection = useMemo(
    () => detectMode(value, cursorPos, namespaces),
    [value, cursorPos, namespaces]
  );

  const filtered = useMemo((): HbDropdownItem[] => {
    if (detection.mode === "closed") return [];

    if (detection.mode === "namespace") {
      return namespaces
        .filter((ns) => ns.suggestions.length > 0)
        .map((ns) => ({ kind: "namespace" as const, prefix: ns.prefix, count: ns.suggestions.length }));
    }

    // suggestion mode — filter by partial
    const ns = namespaces.find((n) => n.prefix === detection.prefix);
    if (!ns) return [];
    const lower = detection.partial.toLowerCase();
    const matched = lower
      ? ns.suggestions.filter((s) => s.toLowerCase().includes(lower))
      : ns.suggestions;
    return matched.map((key) => ({ kind: "suggestion" as const, prefix: detection.prefix, key }));
  }, [detection, namespaces]);

  const hasNoSuggestions = detection.mode !== "closed" && filtered.length === 0;

  const handleSelect = useCallback(
    (item: HbDropdownItem) => {
      const before = value.slice(0, cursorPos);
      const after = value.slice(cursorPos);
      const openIdx = before.lastIndexOf("{{");
      if (openIdx === -1) return;

      if (item.kind === "namespace") {
        // Drill into namespace: insert "{{prefix." and keep the dropdown open
        const inserted = `{{${item.prefix}.`;
        const newValue = `${before.slice(0, openIdx)}${inserted}${after}`;
        const newCursor = openIdx + inserted.length;
        onChange(newValue);
        setCursorPos(newCursor);
        setIsOpen(true);
        setTimeout(() => {
          const el = inputRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(newCursor, newCursor);
          }
        }, 0);
      } else {
        // Insert full "{{prefix.key}}" token and close
        const inserted = `{{${item.prefix}.${item.key}}}`;
        const newValue = `${before.slice(0, openIdx)}${inserted}${after}`;
        const newCursor = openIdx + inserted.length;
        onChange(newValue);
        setCursorPos(newCursor);
        setIsOpen(false);
        setTimeout(() => {
          const el = inputRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(newCursor, newCursor);
          }
        }, 0);
      }
    },
    [value, cursorPos, onChange]
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

      const d = detectMode(newValue, newCursor, namespaces);
      if (d.mode === "closed") {
        setIsOpen(false);
      } else {
        setIsOpen(true);
        setSelectedIndex(0);
      }
    },
    [onChange, namespaces, setSelectedIndex]
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
    const d = detectMode(value, pos, namespaces);
    if (d.mode !== "closed") {
      setIsOpen(true);
      setSelectedIndex(0);
    }
  }, [value, namespaces, setSelectedIndex]);

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
