import { Box, Text, useInput } from "ink";
import { useEffect, useReducer, useState } from "react";
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
import type { SlashRegistry } from "../slash/registry.js";

export interface PaletteState {
  active: boolean;
  query: string;
  index: number;
}

export interface EditorProps {
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  prompt?: string;
  initialHistory?: HistoryStore;
  isFocused?: boolean;
  // When set, composing a `/command` (no space yet) opens the slash
  // autocomplete: ↑/↓ select, Tab completes, Enter runs the highlighted
  // command. The parent renders the dropdown from `onPaletteState`.
  registry?: SlashRegistry;
  onPaletteState?: (state: PaletteState) => void;
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
        action.kind === "CANCEL" ||
        action.kind === "COMPLETE"
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
  const [paletteIndex, setPaletteIndex] = useState(0);

  const text = bufferText(editor);
  // The palette opens only while typing the command token itself: a
  // leading "/" and no space/newline yet. Typing a space (args) closes it.
  const paletteOpen =
    props.registry !== undefined &&
    text.startsWith("/") &&
    !text.includes(" ") &&
    !text.includes("\n");
  const query = paletteOpen ? text.slice(1) : "";
  const matches = paletteOpen ? props.registry!.findMatches(query) : [];
  const selected = matches.length
    ? Math.min(paletteIndex, matches.length - 1)
    : 0;

  // A new filter resets the highlight to the top of the list.
  useEffect(() => {
    setPaletteIndex(0);
  }, [query, paletteOpen]);

  // Lift palette state so the parent can render the dropdown above the
  // input frame (the Editor owns the keyboard; the parent owns layout).
  const notifyPalette = props.onPaletteState;
  useEffect(() => {
    notifyPalette?.({
      active: paletteOpen && matches.length > 0,
      query,
      index: selected,
    });
  }, [notifyPalette, paletteOpen, matches.length, query, selected]);

  function handle(action: KeymapAction): void {
    if (action.kind === "CANCEL") {
      if (props.onCancel) props.onCancel();
      return;
    }
    // Slash-autocomplete interactions take priority while the palette is
    // open with results: navigate / complete / run the highlighted command.
    if (paletteOpen && matches.length > 0) {
      if (action.kind === "MOVE_UP") {
        setPaletteIndex(Math.max(0, selected - 1));
        return;
      }
      if (action.kind === "MOVE_DOWN") {
        setPaletteIndex(Math.min(matches.length - 1, selected + 1));
        return;
      }
      if (action.kind === "COMPLETE") {
        dispatch({ kind: "SET_TEXT", text: `/${matches[selected]!.name} ` });
        return;
      }
      if (action.kind === "SUBMIT") {
        dispatch({ kind: "CLEAR" });
        props.onSubmit(`/${matches[selected]!.name}`);
        return;
      }
    }
    // Tab outside the palette is a no-op (not an editor action).
    if (action.kind === "COMPLETE") return;
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
