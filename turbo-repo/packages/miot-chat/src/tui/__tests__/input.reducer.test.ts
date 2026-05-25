import { describe, expect, it } from "vitest";
import {
  applyEditor,
  bufferText,
  initialEditor,
  type EditorAction,
  type EditorState,
} from "../input/reducer.js";

function make(lines: string[], row: number, col: number): EditorState {
  return { lines, cursor: { row, col }, selectionAnchor: null };
}

function run(start: EditorState, actions: EditorAction[]): EditorState {
  return actions.reduce((s, a) => applyEditor(s, a), start);
}

describe("input reducer — initial state", () => {
  it("starts with one empty line and cursor at origin", () => {
    const s = initialEditor();
    expect(s.lines).toEqual([""]);
    expect(s.cursor).toEqual({ row: 0, col: 0 });
    expect(s.selectionAnchor).toBeNull();
  });

  it("bufferText joins lines with \\n", () => {
    expect(bufferText({ lines: ["a", "b"], cursor: { row: 0, col: 0 }, selectionAnchor: null })).toBe("a\nb");
  });
});

describe("input reducer — INSERT", () => {
  it("inserts a char at the cursor and advances col", () => {
    const s = run(initialEditor(), [{ kind: "INSERT", text: "h" }]);
    expect(s.lines).toEqual(["h"]);
    expect(s.cursor).toEqual({ row: 0, col: 1 });
  });

  it("inserts multi-char run", () => {
    const s = run(initialEditor(), [{ kind: "INSERT", text: "hi" }]);
    expect(s.lines).toEqual(["hi"]);
    expect(s.cursor).toEqual({ row: 0, col: 2 });
  });

  it("inserts in the middle of an existing line", () => {
    const start = make(["abcd"], 0, 2);
    const s = applyEditor(start, { kind: "INSERT", text: "X" });
    expect(s.lines).toEqual(["abXcd"]);
    expect(s.cursor).toEqual({ row: 0, col: 3 });
  });

  it("INSERT does not split on \\n (PASTE does)", () => {
    const s = applyEditor(initialEditor(), { kind: "INSERT", text: "a\nb" });
    expect(s.lines).toEqual(["a\nb"]);
    expect(s.cursor).toEqual({ row: 0, col: 3 });
  });
});

describe("input reducer — BACKSPACE", () => {
  it("removes the previous char when col > 0", () => {
    const s = applyEditor(make(["abc"], 0, 2), { kind: "BACKSPACE" });
    expect(s.lines).toEqual(["ac"]);
    expect(s.cursor).toEqual({ row: 0, col: 1 });
  });

  it("is a no-op at the very start of the document", () => {
    const start = make([""], 0, 0);
    const s = applyEditor(start, { kind: "BACKSPACE" });
    expect(s).toEqual(start);
  });

  it("joins the current line with the previous when col == 0 and row > 0", () => {
    const start = make(["hello", "world"], 1, 0);
    const s = applyEditor(start, { kind: "BACKSPACE" });
    expect(s.lines).toEqual(["helloworld"]);
    expect(s.cursor).toEqual({ row: 0, col: 5 });
  });
});

describe("input reducer — DELETE_FORWARD", () => {
  it("removes the char to the right of the cursor", () => {
    const s = applyEditor(make(["abc"], 0, 1), { kind: "DELETE_FORWARD" });
    expect(s.lines).toEqual(["ac"]);
    expect(s.cursor).toEqual({ row: 0, col: 1 });
  });

  it("at end of line joins next line into current", () => {
    const start = make(["hi", "there"], 0, 2);
    const s = applyEditor(start, { kind: "DELETE_FORWARD" });
    expect(s.lines).toEqual(["hithere"]);
    expect(s.cursor).toEqual({ row: 0, col: 2 });
  });

  it("at end of doc is a no-op", () => {
    const start = make(["abc"], 0, 3);
    const s = applyEditor(start, { kind: "DELETE_FORWARD" });
    expect(s).toEqual(start);
  });
});

describe("input reducer — cursor movement", () => {
  it("MOVE_LEFT at col 0 row 0 is a no-op", () => {
    const s = applyEditor(initialEditor(), { kind: "MOVE_LEFT" });
    expect(s.cursor).toEqual({ row: 0, col: 0 });
  });

  it("MOVE_LEFT at col 0 row 1 moves to end of previous line", () => {
    const start = make(["hello", "world"], 1, 0);
    const s = applyEditor(start, { kind: "MOVE_LEFT" });
    expect(s.cursor).toEqual({ row: 0, col: 5 });
  });

  it("MOVE_RIGHT at end of line moves to start of next line", () => {
    const start = make(["hi", "there"], 0, 2);
    const s = applyEditor(start, { kind: "MOVE_RIGHT" });
    expect(s.cursor).toEqual({ row: 1, col: 0 });
  });

  it("MOVE_RIGHT at end of doc is a no-op", () => {
    const start = make(["hi"], 0, 2);
    const s = applyEditor(start, { kind: "MOVE_RIGHT" });
    expect(s).toEqual(start);
  });

  it("MOVE_UP at row 0 clamps to col 0", () => {
    const start = make(["hello"], 0, 3);
    const s = applyEditor(start, { kind: "MOVE_UP" });
    expect(s.cursor).toEqual({ row: 0, col: 0 });
  });

  it("MOVE_UP preserves col when target line is long enough", () => {
    const start = make(["hello", "world!"], 1, 3);
    const s = applyEditor(start, { kind: "MOVE_UP" });
    expect(s.cursor).toEqual({ row: 0, col: 3 });
  });

  it("MOVE_DOWN clamps to shorter line length", () => {
    const start = make(["hello", "hi"], 0, 4);
    const s = applyEditor(start, { kind: "MOVE_DOWN" });
    expect(s.cursor).toEqual({ row: 1, col: 2 });
  });

  it("MOVE_DOWN at last row clamps to end of line", () => {
    const start = make(["hello"], 0, 2);
    const s = applyEditor(start, { kind: "MOVE_DOWN" });
    expect(s.cursor).toEqual({ row: 0, col: 5 });
  });

  it("MOVE_HOME moves to col 0", () => {
    const s = applyEditor(make(["hello"], 0, 3), { kind: "MOVE_HOME" });
    expect(s.cursor).toEqual({ row: 0, col: 0 });
  });

  it("MOVE_END moves to line length", () => {
    const s = applyEditor(make(["hello"], 0, 2), { kind: "MOVE_END" });
    expect(s.cursor).toEqual({ row: 0, col: 5 });
  });

  it("MOVE_DOC_HOME jumps to {0,0}", () => {
    const s = applyEditor(make(["a", "bc", "def"], 2, 3), {
      kind: "MOVE_DOC_HOME",
    });
    expect(s.cursor).toEqual({ row: 0, col: 0 });
  });

  it("MOVE_DOC_END jumps to last row + end of last line", () => {
    const s = applyEditor(make(["a", "bc", "def"], 0, 0), {
      kind: "MOVE_DOC_END",
    });
    expect(s.cursor).toEqual({ row: 2, col: 3 });
  });
});

describe("input reducer — word movement", () => {
  it("MOVE_WORD_LEFT from middle of word stops at word start", () => {
    const s = applyEditor(make(["the quick brown"], 0, 7), {
      kind: "MOVE_WORD_LEFT",
    });
    expect(s.cursor).toEqual({ row: 0, col: 4 });
  });

  it("MOVE_WORD_LEFT from word start jumps to previous word start", () => {
    const s = applyEditor(make(["the quick brown"], 0, 4), {
      kind: "MOVE_WORD_LEFT",
    });
    expect(s.cursor).toEqual({ row: 0, col: 0 });
  });

  it("MOVE_WORD_LEFT at col 0 row 1 crosses into previous line end", () => {
    const start = make(["foo bar", "baz"], 1, 0);
    const s = applyEditor(start, { kind: "MOVE_WORD_LEFT" });
    expect(s.cursor).toEqual({ row: 0, col: 4 });
  });

  it("MOVE_WORD_RIGHT from word start jumps to next word start", () => {
    const s = applyEditor(make(["the quick brown"], 0, 0), {
      kind: "MOVE_WORD_RIGHT",
    });
    expect(s.cursor).toEqual({ row: 0, col: 4 });
  });

  it("MOVE_WORD_RIGHT crosses line breaks", () => {
    const start = make(["foo", "bar"], 0, 3);
    const s = applyEditor(start, { kind: "MOVE_WORD_RIGHT" });
    expect(s.cursor).toEqual({ row: 1, col: 0 });
  });
});

describe("input reducer — NEWLINE / KILL_LINE", () => {
  it("NEWLINE splits the current line at the cursor", () => {
    const start = make(["hello world"], 0, 5);
    const s = applyEditor(start, { kind: "NEWLINE" });
    expect(s.lines).toEqual(["hello", " world"]);
    expect(s.cursor).toEqual({ row: 1, col: 0 });
  });

  it("NEWLINE on an empty line keeps two empty lines", () => {
    const start = make([""], 0, 0);
    const s = applyEditor(start, { kind: "NEWLINE" });
    expect(s.lines).toEqual(["", ""]);
    expect(s.cursor).toEqual({ row: 1, col: 0 });
  });

  it("KILL_LINE trims from cursor to end of line", () => {
    const start = make(["hello world"], 0, 5);
    const s = applyEditor(start, { kind: "KILL_LINE" });
    expect(s.lines).toEqual(["hello"]);
    expect(s.cursor).toEqual({ row: 0, col: 5 });
  });

  it("KILL_LINE at end of line joins next line", () => {
    const start = make(["foo", "bar"], 0, 3);
    const s = applyEditor(start, { kind: "KILL_LINE" });
    expect(s.lines).toEqual(["foobar"]);
    expect(s.cursor).toEqual({ row: 0, col: 3 });
  });
});

describe("input reducer — PASTE", () => {
  it("paste with no \\n behaves like INSERT", () => {
    const s = applyEditor(initialEditor(), { kind: "PASTE", text: "abc" });
    expect(s.lines).toEqual(["abc"]);
    expect(s.cursor).toEqual({ row: 0, col: 3 });
  });

  it("paste with \\n splits into multiple lines and lands at end of pasted block", () => {
    const start = make(["hello"], 0, 5);
    const s = applyEditor(start, { kind: "PASTE", text: "\nworld" });
    expect(s.lines).toEqual(["hello", "world"]);
    expect(s.cursor).toEqual({ row: 1, col: 5 });
  });

  it("paste inserts inside an existing line correctly", () => {
    const start = make(["ad"], 0, 1);
    const s = applyEditor(start, { kind: "PASTE", text: "b\nc" });
    expect(s.lines).toEqual(["ab", "cd"]);
    expect(s.cursor).toEqual({ row: 1, col: 1 });
  });
});

describe("input reducer — CLEAR / SET_TEXT", () => {
  it("CLEAR returns to the initial state", () => {
    const start = make(["hello", "world"], 1, 2);
    const s = applyEditor(start, { kind: "CLEAR" });
    expect(s).toEqual(initialEditor());
  });

  it("SET_TEXT replaces lines and places cursor at end", () => {
    const s = applyEditor(initialEditor(), {
      kind: "SET_TEXT",
      text: "alpha\nbeta",
    });
    expect(s.lines).toEqual(["alpha", "beta"]);
    expect(s.cursor).toEqual({ row: 1, col: 4 });
  });

  it("SET_TEXT with empty string is equivalent to CLEAR", () => {
    const s = applyEditor(make(["x"], 0, 1), { kind: "SET_TEXT", text: "" });
    expect(s).toEqual(initialEditor());
  });
});
