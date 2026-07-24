"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TextInput } from "flowbite-react";
import {
  useHbAutocomplete,
  type HbDropdownItem,
  type HbNamespace,
} from "@/features/dashboard/dashlets/common/use-hb-autocomplete";
import { DropdownList } from "@/features/dashboard/dashlets/common/dropdown-list";
import { VARIABLE_GROUPS } from "./review-integration.types";

/**
 * The mapping template field: a text input that autocompletes the context objects.
 *
 * Typing `{{` lists the objects (task, content, session); picking one drills into its
 * fields; typing `{{content.me` filters directly. The autocomplete machinery is the
 * dashboard's — the same behaviour operators already know from dashlet settings —
 * rather than a second implementation that would drift from it.
 *
 * Validation is deliberately *not* the dashboard's `getHandlebarsStatus`: that compiles
 * with the real Handlebars engine and would accept `{{#if}}`, which this field's server
 * rejects. The caller passes `color` from `checkTemplate`, which mirrors the server.
 */

/** Each context object and the fields it offers, from the single variable catalog. */
const NAMESPACES: HbNamespace[] = VARIABLE_GROUPS.map((group) => ({
  prefix: group.id,
  suggestions: group.variables.map((variable) =>
    variable.path.slice(group.id.length + 1)
  ),
}));

interface ReviewTemplateInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly color?: "gray" | "success" | "failure";
}

export function ReviewTemplateInput({
  value,
  onChange,
  placeholder,
  color = "gray",
}: Readonly<ReviewTemplateInputProps>) {
  const ac = useHbAutocomplete({ value, onChange, namespaces: NAMESPACES });
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  // The drawer scrolls and clips; a portal keeps the list out of its overflow.
  useEffect(() => {
    if (!ac.isOpen || !ac.inputRef.current) return;
    const rect = ac.inputRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [ac.isOpen, ac.filtered, ac.inputRef]);

  return (
    <div ref={ac.containerRef} className="relative">
      <TextInput
        ref={ac.inputRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={ac.handleChange}
        onClick={ac.handleClick}
        onKeyDown={ac.handleKeyDownCombined}
        placeholder={placeholder}
        sizing="sm"
        color={color}
        className="font-mono [&_input]:text-xs"
        autoComplete="off"
      />
      {ac.isOpen &&
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
              items={ac.filtered}
              selectedIndex={ac.selectedIndex}
              onSelect={ac.handleSelect}
              onHover={ac.setSelectedIndex}
              dropdownRef={ac.dropdownRef}
              getKey={(item: HbDropdownItem) =>
                item.kind === "namespace"
                  ? `ns:${item.prefix}`
                  : `${item.prefix}.${item.key}`
              }
              renderItem={(item: HbDropdownItem) =>
                item.kind === "namespace" ? (
                  <span className="font-mono text-xs">
                    {"{{"}
                    <span className="font-semibold">{item.prefix}</span>
                    {".*}}"}
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      {item.count}
                    </span>
                  </span>
                ) : (
                  <span className="font-mono text-xs">
                    {`{{${item.prefix}.`}
                    <span className="font-semibold">{item.key}</span>
                    {"}}"}
                  </span>
                )
              }
            />
          </div>,
          document.body
        )}
    </div>
  );
}
