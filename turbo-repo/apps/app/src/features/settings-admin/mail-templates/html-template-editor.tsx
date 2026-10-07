"use client";

import { useEffect, useRef } from "react";
import {
  autocompletion,
  closeBrackets,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { html, htmlLanguage } from "@codemirror/lang-html";
import {
  bracketMatching,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { forceLinting, linter, type Diagnostic } from "@codemirror/lint";
import { Compartment, EditorState } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { handlebarsCompletions, problemOffset } from "./mail-template-model";

/** A problem the server found in the template, as it reported it. */
export interface TemplateProblem {
  readonly message: string;
}

const highlight = HighlightStyle.define([
  { tag: tags.tagName, class: "text-blue-700 dark:text-blue-400" },
  { tag: tags.attributeName, class: "text-violet-600 dark:text-violet-400" },
  { tag: tags.attributeValue, class: "text-green-700 dark:text-green-400" },
  { tag: tags.string, class: "text-green-700 dark:text-green-400" },
  { tag: tags.comment, class: "italic text-gray-400" },
  { tag: tags.angleBracket, class: "text-gray-400" },
  { tag: tags.propertyName, class: "text-sky-700 dark:text-sky-400" },
  { tag: tags.number, class: "text-rose-600 dark:text-rose-400" },
]);

// `{{…}}` stands out from the HTML around it, attribute values included.
const mustache = new MatchDecorator({
  regexp: /\{\{[^{}]*\}\}/g,
  decoration: Decoration.mark({ class: "cm-mustache" }),
});

const mustaches = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = mustache.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = mustache.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

/**
 * Inserts the name and adds `}}` unless the closing braces are already there.
 * The caret lands after the braces, or after `{{#if ` to type the condition.
 */
function applyName(name: string, opensBlock: boolean) {
  return (view: EditorView, _c: Completion, from: number, to: number) => {
    const closed = view.state.sliceDoc(to, to + 2) === "}}";
    const head = opensBlock ? `${name} ` : name;
    view.dispatch({
      changes: { from, to, insert: closed ? head : `${head}}}` },
      selection: { anchor: from + head.length + (opensBlock ? 0 : 2) },
    });
  };
}

function variableCompletions(
  variables: () => string[],
  describe: (name: string) => string
) {
  return (ctx: CompletionContext) => {
    const typed = ctx.matchBefore(/\{\{[#/^~]?\s*\w*/);
    if (!typed) return null;
    const result = handlebarsCompletions(typed.text, variables());
    if (!result) return null;
    const options: Completion[] = result.names.map((name) => {
      if (result.kind === "variable") {
        return {
          label: name,
          detail: describe(name),
          type: "variable",
          apply: applyName(name, false),
        };
      }
      return {
        label: name,
        type: "keyword",
        apply: applyName(name, result.kind === "open"),
      };
    });
    return { from: typed.from + result.offset, options, validFor: /^\w*$/ };
  };
}

interface HtmlTemplateEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly variables: string[];
  /** Variable descriptions, shown next to each completion. */
  readonly describe: (name: string) => string;
  readonly problem: TemplateProblem | null;
  readonly readOnly?: boolean;
  readonly ariaLabel: string;
  /** Receives the editor, so a caller can insert at the cursor. */
  readonly onReady?: (view: EditorView | null) => void;
}

/**
 * The HTML body of an email template: HTML highlighting, tag and attribute
 * completion, `{{variable}}` completion and highlighting, and the server's
 * error underlined where Handlebars reported it.
 */
export default function HtmlTemplateEditor({
  value,
  onChange,
  variables,
  describe,
  problem,
  readOnly = false,
  ariaLabel,
  onReady,
}: HtmlTemplateEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editable = useRef(new Compartment());
  const view = useRef<EditorView | null>(null);
  // Extensions read these through a ref, so the editor is built once.
  const latest = useRef({ onChange, variables, describe, problem });
  latest.current = { onChange, variables, describe, problem };

  useEffect(() => {
    if (!host.current) return;
    const lint = linter(
      (v) => {
        const current = latest.current.problem;
        if (!current) return [];
        const length = v.state.doc.length;
        const from = Math.min(
          problemOffset(current.message, v.state.doc.toString()),
          Math.max(0, length - 1)
        );
        const diagnostic: Diagnostic = {
          from,
          to: Math.min(length, from + 1),
          severity: "error",
          message: current.message,
        };
        return [diagnostic];
      },
      { delay: 50 }
    );
    view.current = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          html({ autoCloseTags: true }),
          htmlLanguage.data.of({
            autocomplete: variableCompletions(
              () => latest.current.variables,
              (name) => latest.current.describe(name)
            ),
          }),
          syntaxHighlighting(highlight),
          mustaches,
          bracketMatching(),
          closeBrackets(),
          autocompletion({ icons: false }),
          lint,
          EditorView.lineWrapping,
          editable.current.of(EditorView.editable.of(!readOnly)),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) latest.current.onChange(u.state.doc.toString());
          }),
          EditorView.theme({
            "&": { fontSize: "12.5px", height: "520px" },
            "&.cm-focused": { outline: "none" },
            ".cm-scroller": {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            },
            ".cm-gutters": { backgroundColor: "transparent", border: "none" },
            ".cm-mustache": {
              color: "#b45309",
              backgroundColor: "rgba(250, 181, 94, 0.18)",
              borderRadius: "3px",
              fontWeight: "600",
            },
          }),
        ],
      }),
      parent: host.current,
    });
    onReady?.(view.current);
    return () => {
      onReady?.(null);
      view.current?.destroy();
      view.current = null;
    };
    // Built once; value, problems and readOnly are pushed in by the effects below.
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

  useEffect(() => {
    if (view.current) forceLinting(view.current);
  }, [problem]);

  return (
    <div
      ref={host}
      className="overflow-hidden rounded-md border border-gray-300 bg-gray-50 text-gray-900 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
    />
  );
}
