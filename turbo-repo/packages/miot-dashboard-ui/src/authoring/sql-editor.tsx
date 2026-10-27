"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { SQLDialect, sql, type SQLNamespace } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  placeholder,
  type DecorationSet,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { SourceSchema } from "@microboxlabs/miot-dashboard-contract/authoring";

/** GoogleSQL as BigQuery reads it: backtick names, `#` comments and `@name` parameters. */
export const BIGQUERY_SQL = SQLDialect.define({
  keywords:
    "all and any array as asc assert_rows_modified at between by case cast collate contains create cross cube current default define desc distinct else end enum escape except exclude exists extract fetch following for from full group grouping groups hash having if ignore in inner intersect interval into is join lateral left like limit lookup merge natural new no not nulls of offset on or order outer over partition preceding proto qualify range recursive respect right rollup rows select set some struct tablesample then to treat unbounded union unnest using when where window with within",
  types:
    "int64 float64 numeric bignumeric bool string bytes date datetime time timestamp geography json",
  builtin:
    "count countif sum avg min max round safe_divide safe_cast coalesce ifnull nullif array_agg string_agg date_add date_sub date_diff date_trunc datetime_trunc timestamp_trunc timestamp_diff format_date format_timestamp parse_date current_date current_datetime current_timestamp lower upper concat",
  identifierQuotes: "`",
  hashComments: true,
  specialVar: "@",
});

// A variable rather than an inline array: TypeScript's import scanner reads
// `define([...])` as an AMD module list.
const highlightSpecs = [
  { tag: tags.keyword, class: "miot-sql-keyword" },
  { tag: tags.typeName, class: "miot-sql-type" },
  { tag: tags.standard(tags.name), class: "miot-sql-builtin" },
  { tag: tags.special(tags.name), class: "miot-sql-parameter" },
  { tag: tags.special(tags.string), class: "miot-sql-identifier" },
  { tag: tags.string, class: "miot-sql-string" },
  { tag: [tags.number, tags.bool, tags.null], class: "miot-sql-literal" },
  { tag: [tags.lineComment, tags.blockComment], class: "miot-sql-comment" },
];
const highlight = HighlightStyle.define(highlightSpecs);

/** Datasets, tables and columns for completion: `dataset.table` and its columns. */
export function completionSchema(schema: SourceSchema | null): SQLNamespace {
  const namespace: Record<string, SQLNamespace> = {};
  for (const dataset of schema?.datasets ?? []) {
    const tables: Record<string, SQLNamespace> = {};
    for (const table of dataset.tables)
      tables[table.name] = table.columns.map((column) => ({
        label: column.name,
        type: "property",
        detail: column.type,
      }));
    namespace[dataset.name] = tables;
  }
  return namespace;
}

const setProblemLine = StateEffect.define<number | null>();
const problemLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setProblemLine)) continue;
      const line = effect.value;
      next =
        line === null || line < 1 || line > transaction.state.doc.lines
          ? Decoration.none
          : Decoration.set([
              Decoration.line({ class: "miot-sql-problem-line" }).range(
                transaction.state.doc.line(line).from,
              ),
            ]);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export interface SqlEditorHandle {
  /** Replace the selection with `text` and focus the editor. */
  insert(text: string): void;
  focus(): void;
}

export interface SqlEditorProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (sql: string) => void;
  readonly schema?: SourceSchema | null;
  /** 1-based line to mark, from a BigQuery error. */
  readonly problemLine?: number | null;
  /** ⌘↵ / Ctrl↵. */
  readonly onRun?: () => void;
  readonly placeholder?: string;
  readonly ariaLabel?: string;
}

/** CodeMirror editor for BigQuery SQL with schema completion. */
export const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(
  function SqlEditor(
    {
      id,
      value,
      onChange,
      schema = null,
      problemLine: line = null,
      onRun,
      placeholder: hint,
      ariaLabel,
    },
    ref,
  ) {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const language = useRef(new Compartment());
    const [initial] = useState(value);
    const latest = useRef({ onChange, onRun });
    latest.current = { onChange, onRun };

    useImperativeHandle(ref, () => ({
      insert(text) {
        const editor = view.current;
        if (!editor) return;
        editor.dispatch(editor.state.replaceSelection(text));
        editor.focus();
      },
      focus: () => view.current?.focus(),
    }));

    useEffect(() => {
      if (!host.current) return;
      view.current = new EditorView({
        state: EditorState.create({
          doc: initial,
          extensions: [
            history(),
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  latest.current.onRun?.();
                  return true;
                },
              },
              ...defaultKeymap,
              ...historyKeymap,
            ]),
            language.current.of(
              sql({ dialect: BIGQUERY_SQL, upperCaseKeywords: true }),
            ),
            syntaxHighlighting(highlight),
            autocompletion({ icons: false }),
            problemLine,
            ...(hint ? [placeholder(hint)] : []),
            EditorView.lineWrapping,
            EditorView.contentAttributes.of({
              id,
              spellcheck: "false",
              ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
            }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged)
                latest.current.onChange(update.state.doc.toString());
            }),
          ],
        }),
        parent: host.current,
      });
      return () => {
        view.current?.destroy();
        view.current = null;
      };
      // Built once; later values are written in by the effects below.
    }, []);

    useEffect(() => {
      const editor = view.current;
      if (!editor || editor.state.doc.toString() === value) return;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
      });
    }, [value]);

    useEffect(() => {
      view.current?.dispatch({
        effects: language.current.reconfigure(
          sql({
            dialect: BIGQUERY_SQL,
            upperCaseKeywords: true,
            schema: completionSchema(schema),
          }),
        ),
      });
    }, [schema]);

    useEffect(() => {
      view.current?.dispatch({ effects: setProblemLine.of(line) });
    }, [line, value]);

    return <div ref={host} className="miot-sql-editor" />;
  },
);
