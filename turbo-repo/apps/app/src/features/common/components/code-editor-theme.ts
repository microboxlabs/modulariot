import { EditorView } from "@codemirror/view";

/** Shared typography and spacing for the app's embedded code editors. */
export function codeEditorTheme(minHeight: string) {
  return EditorView.theme({
    "&": { fontSize: "13px", backgroundColor: "transparent" },
    "&.cm-focused": { outline: "none" },
    ".cm-content": {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      padding: "8px 0",
      lineHeight: "19px",
      minHeight,
    },
    ".cm-line": { padding: "0 10px" },
  });
}
