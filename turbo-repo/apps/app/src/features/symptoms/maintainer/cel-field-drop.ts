import { EditorView } from "@codemirror/view";

/** Relative cursor position carried alongside a field's plain-text expression. */
export const FIELD_CARET_MIME = "application/x-miot-cel-caret";

/** Insert a dragged field at the drop position, preserving its placeholder cursor. */
export function dropField(event: DragEvent, view: EditorView): boolean {
  const data = event.dataTransfer;
  if (!data) return false;
  const offset = data.getData(FIELD_CARET_MIME);
  if (offset === "") return false;
  if (view.state.readOnly || !view.state.facet(EditorView.editable)) {
    event.preventDefault();
    return true;
  }
  const text = data.getData("text/plain");
  const caret = Number(offset);
  if (!Number.isSafeInteger(caret) || caret < 0 || caret > text.length)
    return false;
  const at = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (at === null) return false;
  event.preventDefault();
  view.dispatch({
    changes: { from: at, insert: text },
    selection: { anchor: at + caret },
    scrollIntoView: true,
    userEvent: "input.drop",
  });
  view.focus();
  return true;
}
