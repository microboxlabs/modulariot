export interface EditorCursor {
  row: number;
  col: number;
}

export interface EditorState {
  lines: string[];
  cursor: EditorCursor;
  selectionAnchor: EditorCursor | null;
}

export type EditorAction =
  | { kind: "INSERT"; text: string }
  | { kind: "BACKSPACE" }
  | { kind: "DELETE_FORWARD" }
  | { kind: "MOVE_LEFT" }
  | { kind: "MOVE_RIGHT" }
  | { kind: "MOVE_UP" }
  | { kind: "MOVE_DOWN" }
  | { kind: "MOVE_WORD_LEFT" }
  | { kind: "MOVE_WORD_RIGHT" }
  | { kind: "MOVE_HOME" }
  | { kind: "MOVE_END" }
  | { kind: "MOVE_DOC_HOME" }
  | { kind: "MOVE_DOC_END" }
  | { kind: "NEWLINE" }
  | { kind: "KILL_LINE" }
  | { kind: "PASTE"; text: string }
  | { kind: "CLEAR" }
  | { kind: "SET_TEXT"; text: string };

const WORD_RE = /[A-Za-z0-9_]/;

export function initialEditor(): EditorState {
  return { lines: [""], cursor: { row: 0, col: 0 }, selectionAnchor: null };
}

export function bufferText(state: EditorState): string {
  return state.lines.join("\n");
}

export function applyEditor(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.kind) {
    case "INSERT":
      return insertAtCursor(state, action.text);
    case "BACKSPACE":
      return backspace(state);
    case "DELETE_FORWARD":
      return deleteForward(state);
    case "MOVE_LEFT":
      return moveLeft(state);
    case "MOVE_RIGHT":
      return moveRight(state);
    case "MOVE_UP":
      return moveUp(state);
    case "MOVE_DOWN":
      return moveDown(state);
    case "MOVE_WORD_LEFT":
      return moveWordLeft(state);
    case "MOVE_WORD_RIGHT":
      return moveWordRight(state);
    case "MOVE_HOME":
      return setCursor(state, state.cursor.row, 0);
    case "MOVE_END":
      return setCursor(state, state.cursor.row, lineAt(state, state.cursor.row).length);
    case "MOVE_DOC_HOME":
      return setCursor(state, 0, 0);
    case "MOVE_DOC_END": {
      const lastRow = state.lines.length - 1;
      return setCursor(state, lastRow, lineAt(state, lastRow).length);
    }
    case "NEWLINE":
      return splitLine(state);
    case "KILL_LINE":
      return killLine(state);
    case "PASTE":
      return pasteAtCursor(state, action.text);
    case "CLEAR":
      return initialEditor();
    case "SET_TEXT":
      return setText(action.text);
  }
}

function lineAt(state: EditorState, row: number): string {
  return state.lines[row] ?? "";
}

function setCursor(
  state: EditorState,
  row: number,
  col: number,
): EditorState {
  return { ...state, cursor: { row, col } };
}

function insertAtCursor(state: EditorState, text: string): EditorState {
  const { row, col } = state.cursor;
  const line = lineAt(state, row);
  const next = line.slice(0, col) + text + line.slice(col);
  const lines = state.lines.slice();
  lines[row] = next;
  return { ...state, lines, cursor: { row, col: col + text.length } };
}

function backspace(state: EditorState): EditorState {
  const { row, col } = state.cursor;
  if (col > 0) {
    const line = lineAt(state, row);
    const next = line.slice(0, col - 1) + line.slice(col);
    const lines = state.lines.slice();
    lines[row] = next;
    return { ...state, lines, cursor: { row, col: col - 1 } };
  }
  if (row === 0) return state;
  const prev = lineAt(state, row - 1);
  const curr = lineAt(state, row);
  const merged = prev + curr;
  const lines = state.lines.slice();
  lines.splice(row - 1, 2, merged);
  return { ...state, lines, cursor: { row: row - 1, col: prev.length } };
}

function deleteForward(state: EditorState): EditorState {
  const { row, col } = state.cursor;
  const line = lineAt(state, row);
  if (col < line.length) {
    const next = line.slice(0, col) + line.slice(col + 1);
    const lines = state.lines.slice();
    lines[row] = next;
    return { ...state, lines };
  }
  if (row >= state.lines.length - 1) return state;
  const merged = line + lineAt(state, row + 1);
  const lines = state.lines.slice();
  lines.splice(row, 2, merged);
  return { ...state, lines };
}

function moveLeft(state: EditorState): EditorState {
  const { row, col } = state.cursor;
  if (col > 0) return setCursor(state, row, col - 1);
  if (row === 0) return state;
  return setCursor(state, row - 1, lineAt(state, row - 1).length);
}

function moveRight(state: EditorState): EditorState {
  const { row, col } = state.cursor;
  const line = lineAt(state, row);
  if (col < line.length) return setCursor(state, row, col + 1);
  if (row >= state.lines.length - 1) return state;
  return setCursor(state, row + 1, 0);
}

function moveUp(state: EditorState): EditorState {
  const { row, col } = state.cursor;
  if (row === 0) return setCursor(state, 0, 0);
  const target = lineAt(state, row - 1);
  return setCursor(state, row - 1, Math.min(col, target.length));
}

function moveDown(state: EditorState): EditorState {
  const { row, col } = state.cursor;
  if (row >= state.lines.length - 1) {
    return setCursor(state, row, lineAt(state, row).length);
  }
  const target = lineAt(state, row + 1);
  return setCursor(state, row + 1, Math.min(col, target.length));
}

function isWordChar(ch: string): boolean {
  return WORD_RE.test(ch);
}

function moveWordLeft(state: EditorState): EditorState {
  let { row, col } = state.cursor;
  // If at the start of the line, jump to the end of the previous line
  // and continue the word-left scan from there.
  if (col === 0) {
    if (row === 0) return state;
    row -= 1;
    col = lineAt(state, row).length;
  }
  const line = lineAt(state, row);
  let i = col;
  // Skip whitespace / non-word chars immediately left of cursor.
  while (i > 0 && !isWordChar(line.charAt(i - 1))) i -= 1;
  // Then skip the word characters.
  while (i > 0 && isWordChar(line.charAt(i - 1))) i -= 1;
  return setCursor(state, row, i);
}

function moveWordRight(state: EditorState): EditorState {
  const { row, col } = state.cursor;
  const line = lineAt(state, row);
  if (col >= line.length) {
    if (row >= state.lines.length - 1) return state;
    return setCursor(state, row + 1, 0);
  }
  let i = col;
  // Skip current run of word chars
  while (i < line.length && isWordChar(line.charAt(i))) i += 1;
  // Skip following whitespace / non-word chars
  while (i < line.length && !isWordChar(line.charAt(i))) i += 1;
  return setCursor(state, row, i);
}

function splitLine(state: EditorState): EditorState {
  const { row, col } = state.cursor;
  const line = lineAt(state, row);
  const before = line.slice(0, col);
  const after = line.slice(col);
  const lines = state.lines.slice();
  lines.splice(row, 1, before, after);
  return { ...state, lines, cursor: { row: row + 1, col: 0 } };
}

function killLine(state: EditorState): EditorState {
  const { row, col } = state.cursor;
  const line = lineAt(state, row);
  if (col < line.length) {
    const lines = state.lines.slice();
    lines[row] = line.slice(0, col);
    return { ...state, lines };
  }
  if (row >= state.lines.length - 1) return state;
  const merged = line + lineAt(state, row + 1);
  const lines = state.lines.slice();
  lines.splice(row, 2, merged);
  return { ...state, lines };
}

function pasteAtCursor(state: EditorState, text: string): EditorState {
  if (!text.includes("\n")) return insertAtCursor(state, text);
  const segments = text.split("\n");
  const { row, col } = state.cursor;
  const line = lineAt(state, row);
  const before = line.slice(0, col);
  const after = line.slice(col);
  const head = segments[0] ?? "";
  const tail = segments[segments.length - 1] ?? "";
  const middle = segments.slice(1, -1);
  const lines = state.lines.slice();
  const newLines = [before + head, ...middle, tail + after];
  lines.splice(row, 1, ...newLines);
  const newRow = row + newLines.length - 1;
  const newCol = tail.length;
  return { ...state, lines, cursor: { row: newRow, col: newCol } };
}

function setText(text: string): EditorState {
  if (text.length === 0) return initialEditor();
  const lines = text.split("\n");
  const lastRow = lines.length - 1;
  const lastLine = lines[lastRow] ?? "";
  return {
    lines,
    cursor: { row: lastRow, col: lastLine.length },
    selectionAnchor: null,
  };
}
