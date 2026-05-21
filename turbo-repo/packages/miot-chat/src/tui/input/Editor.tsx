import { Box, Text, useInput } from "ink";
import { useReducer, useState } from "react";
import {
  appendHistory,
  initialHistory,
  navDown,
  navUp,
  type HistoryStore,
} from "./history.js";
import { mapKey, type KeymapAction } from "./keymap.js";
import {
  applyEditor,
  bufferText,
  initialEditor,
  type EditorState,
} from "./reducer.js";

export interface EditorProps {
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  prompt?: string;
  initialHistory?: HistoryStore;
  isFocused?: boolean;
}

export function Editor(props: EditorProps): React.ReactElement {
  const promptPrefix = props.prompt ?? "› ";
  const [editor, dispatch] = useReducer(
    (state: EditorState, action: KeymapAction): EditorState => {
      // Editor-level intercepts that don't reduce to a pure editor action
      // are filtered out before reaching here (in handleAction below). What
      // arrives here are real EditorActions.
      if (
        action.kind === "SUBMIT" ||
        action.kind === "CANCEL"
      ) {
        return state;
      }
      return applyEditor(state, action);
    },
    initialEditor(),
  );
  const [history, setHistory] = useState<HistoryStore>(
    props.initialHistory ?? initialHistory(),
  );

  function handle(action: KeymapAction): void {
    if (action.kind === "CANCEL") {
      if (props.onCancel) props.onCancel();
      return;
    }
    if (action.kind === "SUBMIT") {
      const text = bufferText(editor);
      if (text.trim().length === 0) return;
      setHistory(appendHistory(history, text));
      dispatch({ kind: "CLEAR" });
      props.onSubmit(text);
      return;
    }
    if (action.kind === "MOVE_UP" && editor.cursor.row === 0) {
      const r = navUp(history);
      if (r.text !== null) {
        setHistory(r.store);
        dispatch({ kind: "SET_TEXT", text: r.text });
      }
      return;
    }
    if (
      action.kind === "MOVE_DOWN" &&
      editor.cursor.row === editor.lines.length - 1
    ) {
      const r = navDown(history);
      if (r.text !== null) {
        setHistory(r.store);
        dispatch({ kind: "SET_TEXT", text: r.text });
      }
      return;
    }
    dispatch(action);
  }

  useInput(
    (input, key) => {
      const action = mapKey(input, key);
      if (action) handle(action);
    },
    { isActive: props.isFocused ?? true },
  );

  return (
    <Box flexDirection="column">
      {editor.lines.map((line, row) => (
        <Text key={row}>
          {row === 0 ? promptPrefix : "  "}
          {renderLine(line, row === editor.cursor.row ? editor.cursor.col : null)}
        </Text>
      ))}
    </Box>
  );
}

function renderLine(line: string, cursorCol: number | null): React.ReactNode {
  if (cursorCol === null) return line.length > 0 ? line : " ";
  if (cursorCol >= line.length) {
    return (
      <>
        {line}
        <Text inverse>{" "}</Text>
      </>
    );
  }
  const before = line.slice(0, cursorCol);
  const at = line.charAt(cursorCol);
  const after = line.slice(cursorCol + 1);
  return (
    <>
      {before}
      <Text inverse>{at}</Text>
      {after}
    </>
  );
}
