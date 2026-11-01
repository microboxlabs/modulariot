"use client";

import { useEffect, useRef, useState } from "react";
import { HiCode, HiVariable } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { FIELD } from "@/features/symptoms/maintainer/ui/response-block";
import type { EventField } from "./conversations-types";
import { textVariables } from "./rule-model";

/** Puts text where a field's cursor is; what the variables panel calls on the last focused field. */
export type Inserter = (text: string) => void;

/** The text with `insert` in place of the selection, or wrapped around it with `close`. */
export function spliceSelection(
  value: string,
  start: number,
  end: number,
  insert: string,
  close?: string
): { value: string; caret: number } {
  if (close === undefined)
    return {
      value: value.slice(0, start) + insert + value.slice(end),
      caret: start + insert.length,
    };
  const selected = value.slice(start, end);
  return {
    value: value.slice(0, start) + insert + selected + close + value.slice(end),
    caret:
      start + insert.length + selected.length + (selected ? close.length : 0),
  };
}

const TOOL =
  "flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white";

const FORMATS: {
  mark: string;
  close?: string;
  key: string;
  label: string;
  className: string;
}[] = [
  { mark: "*", key: "fmtBold", label: "B", className: "font-bold" },
  { mark: "_", key: "fmtItalic", label: "I", className: "italic font-serif" },
  { mark: "~", key: "fmtStrike", label: "S", className: "line-through" },
];

/**
 * A template text: a toolbar to insert variables (and WhatsApp's formatting, for the message), the field,
 * and the variables it uses, marked when the event does not give them.
 */
export default function TemplateTextField({
  label,
  value,
  onChange,
  variables,
  known,
  d,
  readOnly = false,
  multiline = true,
  rows = 5,
  formatting = false,
  mono = false,
  placeholder,
  hint,
  onFocusField,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** What the variable menu offers. */
  variables: EventField[];
  /** The variables the event gives; null when no event is picked. */
  known: Set<string> | null;
  d: I18nRecord;
  readOnly?: boolean;
  multiline?: boolean;
  rows?: number;
  /** WhatsApp's bold, italic, strike and monospace buttons. */
  formatting?: boolean;
  /** Monospace, for HTML. */
  mono?: boolean;
  placeholder?: string;
  hint?: string;
  onFocusField?: (insert: Inserter) => void;
}>) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const apply = (insert: string, close?: string) => {
    const el = ref.current;
    // The element's value: an inserter kept by the variables panel may be older than this render.
    const current = el?.value ?? value;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = spliceSelection(current, start, end, insert, close);
    onChange(next.value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };
  const insertVariable: Inserter = (text) => apply(text);

  const used = textVariables(value);
  const Field = multiline ? "textarea" : "input";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </span>
      <div className="rounded-lg border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-900">
        {!readOnly && (
          <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1.5 py-1 dark:border-gray-700 dark:bg-gray-800">
            {formatting &&
              FORMATS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-label={trDynamic(f.key, d)}
                  title={trDynamic(f.key, d)}
                  className={`${TOOL} ${f.className}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => apply(f.mark, f.mark)}
                >
                  {f.label}
                </button>
              ))}
            {formatting && (
              <button
                type="button"
                aria-label={tr("fmtMono", d)}
                title={tr("fmtMono", d)}
                className={TOOL}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => apply("```", "```")}
              >
                <HiCode aria-hidden className="h-4 w-4" />
              </button>
            )}
            {formatting && (
              <span
                aria-hidden
                className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600"
              />
            )}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menu}
                className={`${TOOL} gap-1`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMenu(!menu)}
              >
                <HiVariable aria-hidden className="h-4 w-4" />
                {tr("insertVariable", d)}
              </button>
              {menu && (
                <ul
                  role="menu"
                  aria-label={tr("insertVariable", d)}
                  className="absolute top-full left-0 z-40 mt-1 max-h-64 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-600 dark:bg-gray-700"
                >
                  {variables.length === 0 && (
                    <li className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {tr("noVariables", d)}
                    </li>
                  )}
                  {variables.map((v) => (
                    <li key={v.name} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        title={v.description ?? undefined}
                        className="flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-600"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setMenu(false);
                          apply(`{{${v.name}}}`);
                        }}
                      >
                        <span className="shrink-0 font-mono text-gray-900 dark:text-white">{`{{${v.name}}}`}</span>
                        <span className="min-w-0 flex-1 truncate text-gray-500 dark:text-gray-400">
                          {v.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <Field
          ref={ref}
          aria-label={label}
          rows={multiline ? rows : undefined}
          disabled={readOnly}
          placeholder={placeholder}
          value={value}
          className={`${FIELD} block w-full !rounded-none !border-0 !bg-transparent px-3 py-2 leading-relaxed !ring-0 ${multiline ? "resize-y" : ""} ${mono ? "font-mono !text-xs" : ""}`}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocusField?.(insertVariable)}
        />
      </div>
      {(used.length > 0 || hint) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          {used.map((v) => {
            const missing = known !== null && !known.has(v);
            return (
              <span
                key={v}
                title={missing ? tr("variableNotInEvent", d) : undefined}
                className={`rounded-md border px-1.5 py-0.5 font-mono ${missing ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200" : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"}`}
              >{`{{${v}}}`}</span>
            );
          })}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}
