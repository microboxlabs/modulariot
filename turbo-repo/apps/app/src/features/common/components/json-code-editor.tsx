"use client";

import { useEffect, useRef, useState } from "react";
import {
  autocompletion,
  closeBrackets,
  startCompletion,
  type Completion,
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

export type JsonType = "string" | "number" | "boolean" | "array" | "object";

/** A property an object takes. */
export interface JsonKey {
  label: string;
  type: JsonType;
  detail?: string;
}

/** The properties objects take, offered while typing a key and checked in the text. */
export interface JsonKeys {
  /** By the property the objects sit under; "" for the objects of the top list. */
  objects: Record<string, JsonKey[]>;
  unknown: (key: string) => string;
  wrongType: (key: string, type: JsonType) => string;
}

/** A string in the JSON text and the property it is the value of (the array's, for an item). */
export interface JsonString {
  from: number;
  to: number;
  value: string;
  key: string | null;
  isKey: boolean;
  /** For a key: the property its object sits under, "" at the top. */
  owner?: string;
  /** For a key: the type of its value, once one is written. */
  type?: JsonType;
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
  owner: string;
  keys: string[];
}

function typeAt(c: string): JsonType | undefined {
  if (c === '"') return "string";
  if (c === "[") return "array";
  if (c === "{") return "object";
  if (c === "t" || c === "f") return "boolean";
  if (c === "-" || (c >= "0" && c <= "9")) return "number";
  return undefined;
}

/** Every string of the text and the open containers at its end; a linear scan that tolerates broken JSON. */
function scan(text: string): { strings: JsonString[]; stack: Frame[] } {
  const out: JsonString[] = [];
  const stack: Frame[] = [];
  let pendingKey: string | null = null;
  let awaiting: JsonString | null = null;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const top = stack.at(-1);
    if (awaiting && !/\s/.test(c)) {
      awaiting.type = typeAt(c);
      awaiting = null;
    }
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
        ...(isKey && top ? { owner: top.owner } : {}),
      });
      if (isKey && top) {
        pendingKey = value;
        top.key = value;
        top.keys.push(value);
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
        owner: key ?? "",
        keys: [],
      });
      pendingKey = null;
    } else if (c === "}" || c === "]") {
      stack.pop();
    } else if (c === ":" && top && !top.array) {
      top.expectKey = false;
      const last = out.at(-1);
      awaiting = last?.isKey ? last : null;
    } else if (c === "," && top && !top.array) {
      top.expectKey = true;
    }
    i++;
  }
  return { strings: out, stack };
}

/** Every string of the text with the property it belongs to. */
export function jsonStrings(text: string): JsonString[] {
  return scan(text).strings;
}

/** What starts at the end of `text`, outside any string: a key of an object, or a value of a property. */
export type JsonSlot =
  | { kind: "key"; owner: string; present: string[] }
  | { kind: "value"; key: string };

export function jsonSlot(text: string): JsonSlot | null {
  const { stack } = scan(text);
  const top = stack.at(-1);
  if (!top) return null;
  const before = text.trimEnd().at(-1);
  if (top.array)
    return top.key && (before === "[" || before === ",")
      ? { kind: "value", key: top.key }
      : null;
  if (top.expectKey && (before === "{" || before === ","))
    return { kind: "key", owner: top.owner, present: top.keys };
  if (!top.expectKey && before === ":" && top.key)
    return { kind: "value", key: top.key };
  return null;
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

function keyDiagnostic(
  s: JsonString,
  keys: JsonKeys | undefined
): Diagnostic | null {
  const allowed = keys?.objects[s.owner ?? ""];
  if (!keys || !allowed) return null;
  const known = allowed.find((k) => k.label === s.value);
  if (!known)
    return {
      from: s.from,
      to: s.to,
      severity: "error",
      message: keys.unknown(s.value),
    };
  if (s.type && s.type !== known.type)
    return {
      from: s.from,
      to: s.to,
      severity: "error",
      message: keys.wrongType(s.value, known.type),
    };
  return null;
}

function diagnosticsFor(
  text: string,
  values: Record<string, JsonValues>,
  keys: JsonKeys | undefined,
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
    if (s.isKey) {
      const mark = keyDiagnostic(s, keys);
      if (mark) out.push(mark);
      continue;
    }
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

/** The marks on a text that parses: unknown properties and values, and wrong types. */
export function jsonIssues(
  text: string,
  values: Record<string, JsonValues>,
  keys?: JsonKeys
): { from: number; message: string }[] {
  if (!parseJson(text).ok) return [];
  return diagnosticsFor(text, values, keys, "").map((m) => ({
    from: m.from,
    message: m.message,
  }));
}

/** The index of the item of the top list that holds `pos`; -1 outside them. */
export function jsonItemAt(text: string, pos: number): number {
  let depth = 0;
  let item = -1;
  let i = 0;
  while (i < pos && i < text.length) {
    const c = text[i];
    if (c === '"') {
      i = stringEnd(text, i);
      continue;
    }
    if (c === "{" || c === "[") {
      if (depth === 1) item++;
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
    }
    i++;
  }
  return item;
}

const EMPTY: Record<JsonType, string> = {
  string: '""',
  number: "0",
  boolean: "false",
  array: "[]",
  object: "{}",
};

/** The end of the string text the cursor is in: its closing quote, or the end of the line. */
function textEnd(state: EditorState, pos: number): number {
  const line = state.doc.lineAt(pos);
  let i = pos;
  while (i < line.to) {
    const c = state.sliceDoc(i, i + 1);
    if (c === '"') return i;
    i += c === "\\" ? 2 : 1;
  }
  return line.to;
}

/**
 * Writes the key, with an empty value when it has none, and opens the value's suggestions. Inside a key
 * string the list is filtered by the text before the cursor, and the whole string is replaced.
 */
function keyCompletion(
  k: JsonKey,
  withValue: boolean,
  inString: boolean
): Completion {
  return {
    label: k.label,
    detail: k.detail,
    type: "property",
    apply: (view, _c, start, stop) => {
      const from = inString ? start - 1 : start;
      let to = stop;
      if (inString) {
        to = textEnd(view.state, stop);
        if (view.state.sliceDoc(to, to + 1) === '"') to++;
      }
      const empty = EMPTY[k.type];
      const insert = withValue
        ? `${JSON.stringify(k.label)}: ${empty}`
        : JSON.stringify(k.label);
      const end = from + insert.length;
      const scalar = k.type === "number" || k.type === "boolean";
      let selection = { anchor: end, head: end };
      if (withValue && scalar)
        selection = { anchor: end - empty.length, head: end };
      else if (withValue) selection = { anchor: end - 1, head: end - 1 };
      view.dispatch({ changes: { from, to, insert }, selection });
      if (withValue && (k.type === "string" || k.type === "array"))
        startCompletion(view);
    },
  };
}

/** Values written with their quotes, or inside a string over its whole text. */
function valueCompletions(
  options: JsonValues["options"],
  quoted: boolean
): Completion[] {
  return options.map((o) => ({
    label: o.label,
    detail: o.detail,
    type: "constant",
    apply: quoted
      ? JSON.stringify(o.label)
      : (view, _c, from, to) => {
          const insert = JSON.stringify(o.label).slice(1, -1);
          view.dispatch({
            changes: { from, to: textEnd(view.state, to), insert },
            selection: { anchor: from + insert.length },
          });
        },
  }));
}

export function completions(
  latest: () => { values: Record<string, JsonValues>; keys?: JsonKeys }
) {
  return (ctx: CompletionContext) => {
    const { values, keys } = latest();
    const text = ctx.state.doc.toString();
    const strings = jsonStrings(text);
    const at = strings.find((s) => s.from < ctx.pos && ctx.pos <= s.to);
    if (at?.isKey) {
      const allowed = keys?.objects[at.owner ?? ""];
      if (!allowed?.length) return null;
      const present = strings
        .filter((s) => s.isKey && s.owner === at.owner && s !== at)
        .map((s) => s.value);
      const hasValue = /^\s*:/.test(text.slice(at.to));
      return {
        from: at.from + 1,
        options: allowed
          .filter((k) => !present.includes(k.label))
          .map((k) => keyCompletion(k, !hasValue, true)),
        validFor: /^[^"]*$/,
      };
    }
    if (at) {
      const options = at.key ? values[at.key]?.options : undefined;
      if (!options?.length) return null;
      return {
        from: at.from + 1,
        options: valueCompletions(options, false),
        validFor: /^[^"]*$/,
      };
    }
    const from = ctx.matchBefore(/[\w-]*/)?.from ?? ctx.pos;
    if (from === ctx.pos && !ctx.explicit) return null;
    const slot = jsonSlot(text.slice(0, from));
    if (slot?.kind === "key") {
      const allowed = keys?.objects[slot.owner];
      if (!allowed?.length) return null;
      return {
        from,
        options: allowed
          .filter((k) => !slot.present.includes(k.label))
          .map((k) => keyCompletion(k, true, false)),
        validFor: /^[\w-]*$/,
      };
    }
    if (slot?.kind === "value") {
      const options = values[slot.key]?.options;
      if (!options?.length) return null;
      return {
        from,
        options: valueCompletions(options, true),
        validFor: /^[\w-]*$/,
      };
    }
    return null;
  };
}

/**
 * A JSON editor: highlighting, completion of the properties objects take and of the values each property
 * takes, and marks on unknown properties and values, on wrong types and on syntax errors. It reports the parsed value on every valid edit, and `null` while the text does not
 * parse.
 */
export default function JsonCodeEditor({
  value,
  values = {},
  keys,
  readOnly = false,
  ariaLabel,
  parseError,
  normalize = (data) => data,
  onChange,
}: Readonly<{
  value: unknown;
  values?: Record<string, JsonValues>;
  keys?: JsonKeys;
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
  const latest = useRef({ onChange, values, keys, parseError, normalize });
  latest.current = { onChange, values, keys, parseError, normalize };

  useEffect(() => {
    if (!host.current) return;
    const lint = linter(
      (v) =>
        diagnosticsFor(
          v.state.doc.toString(),
          latest.current.values,
          latest.current.keys,
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
            override: [completions(() => latest.current)],
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
        diagnosticsFor(v.state.doc.toString(), values, keys, parseError)
      )
    );
  }, [values, keys, parseError]);

  return (
    <div
      ref={host}
      className="rounded-md border border-gray-300 bg-gray-50 text-gray-900 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
    />
  );
}
