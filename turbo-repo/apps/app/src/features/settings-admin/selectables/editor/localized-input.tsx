"use client";

import type { KeyboardEvent } from "react";
import { Textarea, TextInput } from "flowbite-react";
import { SELECTABLE_LANGUAGES, type LocalizedText } from "../types";

interface LocalizedInputProps {
  readonly idPrefix: string;
  readonly value: LocalizedText | null | undefined;
  readonly onChange: (next: LocalizedText) => void;
  /** Example text, shown in every language's input. */
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly sizing?: "sm" | "md";
  /** Key handler for the last language's input, e.g. Tab adding a row. */
  readonly onLastKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/** One input per language, side by side, each tagged with its language code. */
export function LocalizedInput({
  idPrefix,
  value,
  onChange,
  placeholder,
  multiline,
  sizing = "md",
  onLastKeyDown,
}: LocalizedInputProps) {
  const set = (lang: string, text: string) =>
    onChange({ ...value, [lang]: text });
  const last = SELECTABLE_LANGUAGES.at(-1);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {SELECTABLE_LANGUAGES.map((lang) =>
        multiline ? (
          <div key={lang} className="relative">
            <Textarea
              id={`${idPrefix}-${lang}`}
              rows={2}
              value={value?.[lang] ?? ""}
              placeholder={placeholder}
              onChange={(e) => set(lang, e.target.value)}
              className="pr-10"
            />
            <span className="pointer-events-none absolute right-2 top-2 text-[10px] font-semibold uppercase text-gray-400">
              {lang}
            </span>
          </div>
        ) : (
          <TextInput
            key={lang}
            id={`${idPrefix}-${lang}`}
            sizing={sizing}
            addon={lang.toUpperCase()}
            value={value?.[lang] ?? ""}
            placeholder={placeholder}
            onChange={(e) => set(lang, e.target.value)}
            onKeyDown={lang === last ? onLastKeyDown : undefined}
          />
        )
      )}
    </div>
  );
}
