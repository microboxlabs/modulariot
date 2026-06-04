"use client";

import { useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TextInput } from "flowbite-react";
import { getHandlebarsStatus, getFlowbiteColor } from "./handlebars-helpers";
import { useHbAutocomplete } from "./use-hb-autocomplete";
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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const ac = useHbAutocomplete({
    value,
    onChange,
    prefix: "filter",
    suggestions: filterSuggestions,
  });

  // Update dropdown position when open
  useEffect(() => {
    if (!ac.isOpen || !ac.inputRef.current) return;
    const rect = ac.inputRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [ac.isOpen, ac.filtered]);

  return (
    <div ref={ac.containerRef} className={`relative ${className ?? ""}`}>
      <TextInput
        ref={ac.inputRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={ac.handleChange}
        onClick={ac.handleClick}
        onKeyDown={ac.handleKeyDownCombined}
        placeholder={placeholder}
        sizing="sm"
        color={getFlowbiteColor(status)}
        autoComplete="off"
      />
      {ac.isOpen &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              minWidth: dropdownPos.width,
              zIndex: 9999,
            }}
          >
            <DropdownList
              items={ac.filtered}
              selectedIndex={ac.selectedIndex}
              onSelect={ac.handleSelect}
              onHover={ac.setSelectedIndex}
              dropdownRef={ac.dropdownRef}
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
