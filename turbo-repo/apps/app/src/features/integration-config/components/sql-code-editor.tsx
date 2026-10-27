"use client";

import { useEffect, useRef, useState } from "react";
import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { SQLDialect, sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/** GoogleSQL as BigQuery reads it: backtick names, `#` comments and `@name` parameters. */
const BigQuerySQL = SQLDialect.define({
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

const highlight = HighlightStyle.define([
  { tag: tags.keyword, class: "text-violet-700 dark:text-violet-400" },
  { tag: tags.typeName, class: "text-teal-700 dark:text-teal-400" },
  { tag: tags.standard(tags.name), class: "text-sky-700 dark:text-sky-400" },
  {
    tag: tags.special(tags.name),
    class: "text-orange-600 dark:text-orange-400",
  },
  {
    tag: tags.special(tags.string),
    class: "text-amber-700 dark:text-amber-400",
  },
  { tag: tags.string, class: "text-green-700 dark:text-green-400" },
  {
    tag: [tags.number, tags.bool, tags.null],
    class: "text-blue-600 dark:text-blue-400",
  },
  { tag: [tags.lineComment, tags.blockComment], class: "italic text-gray-500" },
]);

/** A BigQuery SQL editor with highlighting and keyword completion. */
export default function SqlCodeEditor({
  id,
  value,
  placeholder: hint,
  onChange,
}: Readonly<{
  id: string;
  value: string;
  placeholder?: string;
  onChange: (text: string) => void;
}>) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [initial] = useState(value);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    view.current = new EditorView({
      state: EditorState.create({
        doc: initial,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          sql({ dialect: BigQuerySQL, upperCaseKeywords: true }),
          syntaxHighlighting(highlight),
          autocompletion({ icons: false }),
          ...(hint ? [placeholder(hint)] : []),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ id, spellcheck: "false" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) latest.current(u.state.doc.toString());
          }),
          EditorView.theme({
            "&": { fontSize: "13px", backgroundColor: "transparent" },
            "&.cm-focused": { outline: "none" },
            ".cm-content": {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              padding: "8px 0",
              lineHeight: "19px",
              minHeight: "132px",
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
    // Built once; a value set from outside is written in by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return (
    <div
      ref={host}
      className="rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    />
  );
}
