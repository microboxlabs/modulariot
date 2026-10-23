"use client";

import { useEffect, useRef } from "react";
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
import {
  EditorView,
  keymap,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

/** A field the rule can read: its full path and what to show next to it. */
export interface CelField {
  path: string;
  detail: string;
}

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

export function completions(fields: () => CelField[]) {
  return (ctx: CompletionContext) => {
    // `?` only right after a dot, so a ternary's `?` ends the word.
    const word = ctx.matchBefore(/[A-Za-z_](?:\w|\.\??)*/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    const text = word.text;
    const dot = text.lastIndexOf(".");
    const all = fields();
    if (dot < 0) {
      const roots = [...new Set(all.map((f) => f.path.split(".")[0]))];
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
    // A `.?` read completes like a plain one: `signal.frame.?se` offers `sensors`.
    const prefix = text.slice(0, dot + 1).replaceAll("?", "");
    const optional = text.charAt(dot + 1) === "?" ? 1 : 0;
    const seen = new Map<
      string,
      { label: string; type: string; detail?: string; apply?: string }
    >();
    for (const f of all) {
      if (!f.path.startsWith(prefix)) continue;
      const rest = f.path.slice(prefix.length);
      const segment = rest.split(".")[0];
      if (seen.has(segment)) continue;
      seen.set(
        segment,
        rest.includes(".")
          ? { label: segment, type: "namespace" }
          : { label: segment, type: "property", detail: f.detail }
      );
    }
    if (text.includes(".?") && optional === 0) {
      for (const m of OPTIONAL_METHODS)
        seen.set(`${m}()`, { label: m, type: "method", apply: `${m}()` });
    }
    return {
      from: word.from + dot + 1 + optional,
      options: [...seen.values()],
    };
  };
}

/**
 * A CEL rule editor: highlighting, field completion from the source, and the
 * server's problems underlined where they are. The server checks the rule;
 * this component only edits it.
 */
export default function CelEditor({
  value,
  onChange,
  fields,
  problems = [],
  singleLine = false,
  readOnly = false,
  placeholder,
  ariaLabel,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  fields: CelField[];
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
  const latest = useRef({ onChange, fields, problems });
  latest.current = { onChange, fields, problems };

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
        override: [completions(() => latest.current.fields)],
        icons: false,
      }),
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
        if (u.docChanged) latest.current.onChange(u.state.doc.toString());
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
export function insertIntoFocused(text: string) {
  const v = lastFocused;
  if (!v) return false;
  const { from, to } = v.state.selection.main;
  v.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  v.focus();
  return true;
}
