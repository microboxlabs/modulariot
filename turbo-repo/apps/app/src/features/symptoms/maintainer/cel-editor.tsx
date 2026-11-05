"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import {
  autocompletion,
  closeBrackets,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  syntaxHighlighting,
} from "@codemirror/language";
import { linter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  hoverTooltip,
  keymap,
  placeholder as placeholderExt,
  type Tooltip,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import {
  completionContext,
  macroVariables,
  resolved,
} from "./cel-completion-context";

export { macroVariables } from "./cel-completion-context";

/**
 * A field the rule can read: its full path, its type and unit, what it
 * means, and any other short note (`detail`, such as its origin).
 */
export interface CelField {
  path: string;
  type?: string;
  unit?: string | null;
  description?: string;
  detail?: string;
}

/** Type, unit and note, as shown next to the field's name. */
export function fieldDetail(f: CelField): string {
  return [f.type, f.unit, f.detail].filter(Boolean).join(" · ");
}

/**
 * Values to suggest inside the quotes of a text comparison, by field path:
 * `e.event_type == "` offers the event types the organization received.
 * Any other text is still allowed.
 */
export type CelValues = Record<string, { value: string; detail?: string }[]>;

const ValuesContext = createContext<CelValues>({});

/** Values every rule editor below suggests, unless it is given its own. */
export const CelValuesProvider = ValuesContext.Provider;

/** A problem the server found, at a character offset of the rule. */
export interface CelProblem {
  position: number;
  message: string;
  severity: "error" | "warning";
}

/** The editor that had focus last; the field tree inserts there. */
let lastFocused: EditorView | null = null;

const FUNCTIONS = [
  "has",
  "size",
  "matches",
  "startsWith",
  "endsWith",
  "contains",
  "exists",
  "all",
  "exists_one",
  "filter",
  "map",
];

/** Methods of an optional, offered after a `.?` read: `signal.frame.?gps.?speed.orValue(0.0)`. */
const OPTIONAL_METHODS = ["orValue", "hasValue"];

/** Optional constants a `.?` read is compared with: `signal.frame.?sensors.?panic_button == TRUE`. */
const CONSTANTS = ["TRUE", "FALSE", "NONE"];

const cel = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^\/\/.*/)) return "comment";
    if (
      stream.match(/^"(?:[^"\\]|\\.)*"?/) ||
      stream.match(/^'(?:[^'\\]|\\.)*'?/)
    )
      return "string";
    if (stream.match(/^\d+(\.\d+)?([eE][+-]?\d+)?u?/)) return "number";
    if (stream.match(/^(true|false|null|TRUE|FALSE|NONE)\b/)) return "atom";
    if (stream.match(/^in\b/)) return "keyword";
    if (stream.match(/^(&&|\|\||==|!=|>=|<=|[<>!+\-*/%?:])/)) return "operator";
    if (stream.match(/^\.?[A-Za-z_]\w*(?=\()/)) return "builtin";
    if (stream.match(/^\.\??[A-Za-z_]\w*/)) return "property";
    if (stream.match(/^[A-Za-z_]\w*/)) return "variable";
    stream.next();
    return null;
  },
});

// The root of a field path in bold, the rest of the path in blue, as in the prototype.
const highlight = HighlightStyle.define([
  { tag: tags.keyword, class: "text-violet-600 dark:text-violet-400" },
  { tag: tags.operator, class: "text-rose-600 dark:text-rose-400" },
  { tag: tags.number, class: "text-blue-600 dark:text-blue-400" },
  { tag: tags.string, class: "text-green-700 dark:text-green-400" },
  { tag: tags.atom, class: "text-violet-600 dark:text-violet-400" },
  {
    tag: tags.variableName,
    class: "font-semibold text-gray-900 dark:text-white",
  },
  { tag: tags.propertyName, class: "text-sky-700 dark:text-sky-400" },
  {
    tag: tags.standard(tags.variableName),
    class: "text-cyan-600 dark:text-cyan-400",
  },
  { tag: tags.comment, class: "italic text-gray-400" },
]);

/** A value written inside a CEL literal opened with `quote`. */
function escapeIn(value: string, quote: '"' | "'"): string {
  if (quote === '"') return JSON.stringify(value).slice(1, -1);
  return value.replaceAll("\\", "\\\\").replaceAll("'", String.raw`\'`);
}

function valueCompletions(
  from: number,
  suggested: CelValues[string],
  quote: '"' | "'"
) {
  if (suggested.length === 0) return null;
  return {
    from,
    options: suggested.map((v) => ({
      label: v.value,
      apply: escapeIn(v.value, quote),
      detail: v.detail,
      type: "text",
    })),
    validFor: quote === '"' ? /^[^"\\]*$/ : /^[^'\\]*$/,
  };
}

export function completions(
  fields: () => CelField[],
  values: () => CelValues = () => ({})
) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.state.sliceDoc(0, ctx.pos);
    const { variables, quoted } = completionContext(before);
    if (quoted) {
      return valueCompletions(
        ctx.pos - quoted.typed.length,
        values()[quoted.path] ?? [],
        quoted.quote
      );
    }
    // `?` only right after a dot, so a ternary's `?` ends the word.
    const word = ctx.matchBefore(/[A-Za-z_](?:\w|\.\??)*/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    const text = word.text;
    const dot = text.lastIndexOf(".");
    const all = fields();
    if (dot < 0) {
      const roots = [
        ...new Set([
          ...all.map((f) => f.path.split(".")[0]),
          ...variables.keys(),
        ]),
      ];
      return {
        from: word.from,
        options: [
          ...roots.map((r) => ({ label: r, type: "variable" })),
          ...CONSTANTS.map((c) => ({ label: c, type: "constant" })),
          ...FUNCTIONS.map((f) => ({
            label: f,
            type: "function",
            apply: `${f}()`,
          })),
        ],
      };
    }
    return fieldCompletions(all, text, dot, word.from, variables);
  };
}

type FieldCompletion = Completion & { description?: string };

/** What the field means, below its name in the completion list. */
function renderDescription(completion: FieldCompletion): Node | null {
  if (!completion.description) return null;
  const node = document.createElement("div");
  node.className = "cm-cel-description";
  node.textContent = completion.description;
  return node;
}

function fieldCompletions(
  all: CelField[],
  text: string,
  dot: number,
  from: number,
  variables: Map<string, string>
) {
  // A `.?` read completes like a plain one: `signal.frame.?se` offers `sensors`.
  // `e.` inside `signal.frame.events.exists(e, …)` completes the list's fields.
  const prefix = `${resolved(text.slice(0, dot), variables)}.`;
  const optional = text.charAt(dot + 1) === "?" ? 1 : 0;
  const seen = new Map<string, FieldCompletion>();
  for (const f of all) {
    if (!f.path.startsWith(prefix)) continue;
    const rest = f.path.slice(prefix.length);
    const segment = rest.split(".")[0];
    if (seen.has(segment)) continue;
    seen.set(
      segment,
      rest.includes(".")
        ? { label: segment, type: "namespace" }
        : {
            label: segment,
            type: "property",
            detail: fieldDetail(f) || undefined,
            description: f.description || undefined,
          }
    );
  }
  if (text.includes(".?") && optional === 0) {
    for (const m of OPTIONAL_METHODS)
      seen.set(`${m}()`, { label: m, type: "method", apply: `${m}()` });
  }
  return {
    from: from + dot + 1 + optional,
    options: [...seen.values()],
  };
}

const isPathChar = (text: string, i: number) =>
  /[\w.]/.test(text.charAt(i)) ||
  (text.charAt(i) === "?" && text.charAt(i - 1) === ".");

/**
 * The field under `pos`, up to the end of the hovered segment: hovering
 * `trip` in `signal.trip.age_min` reads `signal.trip`. Null when the field is
 * unknown or has nothing to show.
 */
export function fieldAt(
  text: string,
  pos: number,
  fields: CelField[]
): { from: number; to: number; field: CelField } | null {
  let from = pos;
  while (from > 0 && isPathChar(text, from - 1)) from--;
  let to = pos;
  while (to < text.length && /\w/.test(text.charAt(to))) to++;
  const word = text.slice(from, to);
  if (!/^[A-Za-z_]/.test(word)) return null;
  const path = resolved(word, macroVariables(text.slice(0, from)));
  const field = fields.find((f) => f.path === path);
  if (!field || !(field.description || fieldDetail(field))) return null;
  return { from, to, field };
}

function fieldTooltip(
  view: EditorView,
  pos: number,
  fields: CelField[]
): Tooltip | null {
  const found = fieldAt(view.state.doc.toString(), pos, fields);
  if (!found) return null;
  const { field } = found;
  return {
    pos: found.from,
    end: found.to,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-cel-hover";
      const name = document.createElement("div");
      name.className = "cm-cel-hover-path";
      name.textContent = field.path;
      dom.append(name);
      if (field.description) {
        const text = document.createElement("div");
        text.textContent = field.description;
        dom.append(text);
      }
      const detail = fieldDetail(field);
      if (detail) {
        const note = document.createElement("div");
        note.className = "cm-cel-hover-detail";
        note.textContent = detail;
        dom.append(note);
      }
      return { dom };
    },
  };
}

/**
 * A CEL rule editor: highlighting, field completion from the source, and the
 * server's problems underlined where they are. The server checks the rule;
 * this component only edits it.
 */
const externalValue = Annotation.define<boolean>();

export default function CelEditor({
  value,
  onChange,
  fields,
  values,
  problems = [],
  singleLine = false,
  readOnly = false,
  placeholder,
  ariaLabel,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  fields: CelField[];
  /** Values to suggest inside the quotes of a text comparison, by field path. */
  values?: CelValues;
  problems?: CelProblem[];
  singleLine?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}>) {
  const host = useRef<HTMLDivElement>(null);
  const editable = useRef(new Compartment());
  const view = useRef<EditorView | null>(null);
  // Extensions read these through refs, so the editor is built once.
  const shared = useContext(ValuesContext);
  const suggested = values ?? shared;
  const latest = useRef({ onChange, fields, values: suggested, problems });
  latest.current = { onChange, fields, values: suggested, problems };

  useEffect(() => {
    if (!host.current) return;
    const lint = linter((v) => diagnostics(v, latest.current.problems), {
      delay: 50,
    });
    const extensions = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      cel,
      syntaxHighlighting(highlight),
      bracketMatching(),
      closeBrackets(),
      autocompletion({
        override: [
          completions(
            () => latest.current.fields,
            () => latest.current.values
          ),
        ],
        icons: false,
        addToOptions: [
          {
            render: (completion) =>
              renderDescription(completion as FieldCompletion),
            position: 90,
          },
        ],
      }),
      hoverTooltip((v, pos) => fieldTooltip(v, pos, latest.current.fields)),
      lint,
      EditorView.lineWrapping,
      editable.current.of(EditorView.editable.of(!readOnly)),
      EditorView.contentAttributes.of({ "aria-label": ariaLabel ?? "CEL" }),
      EditorView.domEventHandlers({
        focus: (_event, v) => {
          lastFocused = v;
        },
      }),
      EditorView.updateListener.of((u) => {
        if (
          u.docChanged &&
          !u.transactions.some((t) => t.annotation(externalValue))
        )
          latest.current.onChange(u.state.doc.toString());
      }),
      EditorView.theme({
        "&": {
          fontSize: singleLine ? "12.5px" : "14px",
          backgroundColor: "transparent",
        },
        "&.cm-focused": { outline: "none" },
        ".cm-content": {
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: singleLine ? "6px 0" : "8px 0",
          lineHeight: singleLine ? "normal" : "20px",
          minHeight: singleLine ? "auto" : "116px",
        },
        ".cm-line": { padding: "0 10px" },
        ".cm-tooltip-autocomplete > ul > li": { maxWidth: "28rem" },
        ".cm-cel-description, .cm-cel-hover-detail": {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "11.5px",
          opacity: "0.75",
          whiteSpace: "normal",
        },
        ".cm-cel-hover": {
          maxWidth: "24rem",
          padding: "4px 8px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "12px",
        },
        ".cm-cel-hover-path": {
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontWeight: "600",
        },
      }),
    ];
    if (placeholder) extensions.push(placeholderExt(placeholder));
    if (singleLine) {
      extensions.push(
        EditorState.transactionFilter.of((tr) =>
          tr.newDoc.lines > 1 ? [] : tr
        )
      );
    }
    view.current = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: host.current,
    });
    return () => {
      if (lastFocused === view.current) lastFocused = null;
      view.current?.destroy();
      view.current = null;
    };
    // Built once; value and problems are pushed in by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure(EditorView.editable.of(!readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    const v = view.current;
    if (v && value !== v.state.doc.toString()) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: value },
        annotations: externalValue.of(true),
      });
    }
  }, [value]);

  // Callers build problems on every render; marks are replaced only when they or the text change.
  const marked = useRef<string | null>(null);
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const key = JSON.stringify([value, problems]);
    if (key === marked.current) return;
    marked.current = key;
    v.dispatch(setDiagnostics(v.state, diagnostics(v, problems)));
  }, [value, problems]);

  return (
    <div
      ref={host}
      className={`rounded-md border border-gray-300 text-gray-900 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ${singleLine ? "bg-white" : "bg-gray-50"}`}
    />
  );
}

/** The server's problems as marks one character wide, kept inside the text. */
function diagnostics(v: EditorView, problems: CelProblem[]): Diagnostic[] {
  const length = v.state.doc.length;
  return problems.map((p): Diagnostic => {
    const from = Math.max(0, Math.min(p.position, Math.max(0, length - 1)));
    return {
      from,
      to: Math.min(length, from + 1),
      severity: p.severity,
      message: p.message,
    };
  });
}

/** Inserts text at the cursor of the editor used last, for the field tree. */
export function insertIntoFocused(text: string, caret = text.length) {
  const v = lastFocused;
  if (!v) return false;
  const { from, to } = v.state.selection.main;
  v.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + caret },
  });
  v.focus();
  return true;
}
