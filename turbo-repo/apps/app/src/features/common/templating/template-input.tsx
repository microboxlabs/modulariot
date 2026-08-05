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

export interface TemplateInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly namespaces: readonly { prefix: string; suggestions: string[] }[];
  readonly placeholder?: string;
  readonly color?: "gray" | "success" | "failure";
}

/**
 * THE mapping-template field: the dashboard's `{{` autocomplete over
 * caller-supplied namespaces, validation colour from the caller (which runs
 * `checkTemplate` against its own roots, mirroring the server). One component
 * behind every binding drawer — kanban review channels and calendar
 * enrichment alike — so the authoring experience cannot drift between them.
 */
export function TemplateInput({
  value,
  onChange,
  namespaces,
  placeholder,
  color = "gray",
}: Readonly<TemplateInputProps>) {
  const ac = useHbAutocomplete({
    value,
    onChange,
    namespaces: namespaces as HbNamespace[],
  });
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
