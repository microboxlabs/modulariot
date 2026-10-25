"use client";

import { useEffect, useRef, useState } from "react";
import {
  autocompletion,
  closeBrackets,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  syntaxHighlighting,
} from "@codemirror/language";
import { linter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/** The values a property takes, offered while typing and checked in the text. */
export interface JsonValues {
  options: { label: string; detail?: string }[];
  /** A value not in `options` is marked with this message; omit to only suggest. */
  unknown?: (value: string) => string;
}

/** A string in the JSON text and the property it is the value of (the array's, for an item). */
export interface JsonString {
  from: number;
  to: number;
  value: string;
  key: string | null;
  isKey: boolean;
}

const json = StreamLanguage.define<{ key: boolean }>({
  startState: () => ({ key: false }),
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) {
      return stream.match(/^\s*:/, false) ? "propertyName" : "string";
    }
    if (stream.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)) return "number";
    if (stream.match(/^(true|false|null)\b/)) return "atom";
    stream.next();
    return null;
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.propertyName, class: "text-sky-700 dark:text-sky-400" },
  { tag: tags.string, class: "text-green-700 dark:text-green-400" },
  { tag: tags.number, class: "text-blue-600 dark:text-blue-400" },
  { tag: tags.atom, class: "text-violet-600 dark:text-violet-400" },
]);

/** The end of the string that opens at `start`, past its closing quote. */
function stringEnd(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === "\\") i += 2;
    else if (text[i] === '"') return i + 1;
    else i++;
  }
  return text.length;
}

interface Frame {
  array: boolean;
  key: string | null;
  expectKey: boolean;
}

/** Every string of the text with the property it belongs to; a linear scan that tolerates broken JSON. */
export function jsonStrings(text: string): JsonString[] {
  const out: JsonString[] = [];
  const stack: Frame[] = [];
  let pendingKey: string | null = null;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const top = stack.at(-1);
    if (c === '"') {
      const end = stringEnd(text, i);
      const closed = end - 1 > i && text[end - 1] === '"';
      const raw = text.slice(i + 1, closed ? end - 1 : end);
      const isKey = Boolean(top && !top.array && top.expectKey);
      let value = raw;
      try {
        value = JSON.parse(`"${raw}"`) as string;
      } catch {
        // A string still being typed is read as written.
      }
      out.push({
        from: i,
        to: end,
        value,
        key: isKey ? null : (top?.key ?? null),
        isKey,
      });
      if (isKey && top) {
        pendingKey = value;
        top.key = value;
      }
      i = end;
      continue;
    }
    if (c === "{" || c === "[") {
      const key = top?.array ? top.key : pendingKey;
      stack.push({
        array: c === "[",
        key: c === "[" ? key : null,
        expectKey: c === "{",
      });
      pendingKey = null;
    } else if (c === "}" || c === "]") {
      stack.pop();
    } else if (c === ":" && top && !top.array) {
      top.expectKey = false;
    } else if (c === "," && top && !top.array) {
      top.expectKey = true;
    }
    i++;
  }
  return out;
}

/** The offset of a JSON.parse error, from either message style; 0 when it gives none. */
function errorOffset(message: string, text: string): number {
  const pos = /position (\d+)/.exec(message);
  if (pos) return Number(pos[1]);
  const lc = /line (\d+) column (\d+)/.exec(message);
  if (!lc) return 0;
  const lines = text.split("\n").slice(0, Number(lc[1]) - 1);
  return lines.reduce((n, l) => n + l.length + 1, 0) + Number(lc[2]) - 1;
}

export type JsonParse =
  | { ok: true; data: unknown }
  | { ok: false; message: string; offset: number };

export function parseJson(text: string): JsonParse {
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message, offset: errorOffset(message, text) };
  }
}

function diagnosticsFor(
  text: string,
  values: Record<string, JsonValues>,
  parseError: string
): Diagnostic[] {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    const from = Math.min(parsed.offset, Math.max(0, text.length - 1));
    return [
      {
        from,
        to: Math.min(text.length, from + 1),
        severity: "error",
        message: parseError,
      },
    ];
  }
  const out: Diagnostic[] = [];
  for (const s of jsonStrings(text)) {
    const check = s.key && !s.isKey ? values[s.key] : undefined;
    if (!check?.unknown) continue;
    if (s.value === "" || check.options.some((o) => o.label === s.value))
      continue;
    out.push({
      from: s.from,
      to: s.to,
      severity: "error",
      message: check.unknown(s.value),
    });
  }
  return out;
}

function completions(values: () => Record<string, JsonValues>) {
  return (ctx: CompletionContext) => {
    const strings = jsonStrings(ctx.state.doc.toString());
    const at = strings.find((s) => s.from < ctx.pos && ctx.pos <= s.to);
    if (!at || at.isKey || !at.key) return null;
    const options = values()[at.key]?.options;
    if (!options?.length) return null;
    return {
      from: at.from + 1,
      to:
        at.to > at.from + 1 && ctx.state.sliceDoc(at.to - 1, at.to) === '"'
          ? at.to - 1
          : at.to,
      options: options.map((o) => ({
        label: o.label,
        detail: o.detail,
        type: "constant",
      })),
      validFor: /^[^"]*$/,
    };
  };
}

/**
 * A JSON editor: highlighting, completion of the values each property takes, and marks on unknown values
 * and on syntax errors. It reports the parsed value on every valid edit, and `null` while the text does not
 * parse.
 */
export default function JsonCodeEditor({
  value,
  values = {},
  readOnly = false,
  ariaLabel,
  parseError,
  normalize = (data) => data,
  onChange,
}: Readonly<{
  value: unknown;
  values?: Record<string, JsonValues>;
  readOnly?: boolean;
  ariaLabel: string;
  /** The message on a syntax error. */
  parseError: string;
  /** What a parsed text becomes before it is reported; `value` coming back equal to it keeps the text. */
  normalize?: (data: unknown) => unknown;
  /** The parsed value, or null while the text has a syntax error. */
  onChange: (value: unknown | null, text: string) => void;
}>) {
  const host = useRef<HTMLDivElement>(null);
  const editable = useRef(new Compartment());
  const view = useRef<EditorView | null>(null);
  const [initial] = useState(() => JSON.stringify(value, null, 2));
  // What this editor reported last, so a value it produced is not written back over the text.
  const emitted = useRef(JSON.stringify(value));
  const latest = useRef({ onChange, values, parseError, normalize });
  latest.current = { onChange, values, parseError, normalize };

  useEffect(() => {
    if (!host.current) return;
    const lint = linter(
      (v) =>
        diagnosticsFor(
          v.state.doc.toString(),
          latest.current.values,
          latest.current.parseError
        ),
      { delay: 150 }
    );
    view.current = new EditorView({
      state: EditorState.create({
        doc: initial,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          json,
          syntaxHighlighting(highlight),
          bracketMatching(),
          closeBrackets(),
          autocompletion({
            override: [completions(() => latest.current.values)],
            icons: false,
          }),
          lint,
          editable.current.of(EditorView.editable.of(!readOnly)),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            const text = u.state.doc.toString();
            const parsed = parseJson(text);
            if (!parsed.ok) {
              latest.current.onChange(null, text);
              return;
            }
            const out = latest.current.normalize(parsed.data);
            emitted.current = JSON.stringify(out);
            latest.current.onChange(out, text);
          }),
          EditorView.theme({
            "&": { fontSize: "13px", backgroundColor: "transparent" },
            "&.cm-focused": { outline: "none" },
            ".cm-content": {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              padding: "8px 0",
              lineHeight: "19px",
              minHeight: "160px",
            },
            ".cm-line": { padding: "0 10px" },
          }),
        ],
      }),
      parent: host.current,
    });
    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // Built once; value and readOnly are pushed in by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure(EditorView.editable.of(!readOnly)),
    });
  }, [readOnly]);

  // A change from outside the editor (the server's copy, an undo) replaces the text.
  useEffect(() => {
    const v = view.current;
    const next = JSON.stringify(value);
    if (!v || next === emitted.current) return;
    emitted.current = next;
    v.dispatch({
      changes: {
        from: 0,
        to: v.state.doc.length,
        insert: JSON.stringify(value, null, 2),
      },
    });
  }, [value]);

  // Values the marks check against can arrive after the text (templates, groups).
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch(
      setDiagnostics(
        v.state,
        diagnosticsFor(v.state.doc.toString(), values, parseError)
      )
    );
  }, [values, parseError]);

  return (
    <div
      ref={host}
      className="rounded-md border border-gray-300 bg-gray-50 text-gray-900 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
    />
  );
}
