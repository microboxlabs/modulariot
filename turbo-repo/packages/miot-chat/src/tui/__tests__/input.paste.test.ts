import { describe, expect, it } from "vitest";
import {
  feedPaste,
  initialPaste,
  type PasteState,
  type PasteToken,
} from "../input/paste.js";

function feedAll(chunks: string[]): { state: PasteState; tokens: PasteToken[] } {
  let state = initialPaste();
  const tokens: PasteToken[] = [];
  for (const chunk of chunks) {
    const r = feedPaste(state, chunk);
    state = r.state;
    tokens.push(...r.tokens);
  }
  return { state, tokens };
}

const BEGIN = "\x1b[200~";
const END = "\x1b[201~";

describe("paste detector", () => {
  it("passes plain text through as a text token", () => {
    const { tokens } = feedAll(["hello"]);
    expect(tokens).toEqual([{ kind: "text", text: "hello" }]);
  });

  it("emits a single paste token between the bracketed markers", () => {
    const { tokens } = feedAll([`${BEGIN}hi${END}`]);
    expect(tokens).toEqual([{ kind: "paste", text: "hi" }]);
  });

  it("preserves embedded newlines inside a paste block", () => {
    const { tokens } = feedAll([`${BEGIN}a\nb\nc${END}`]);
    expect(tokens).toEqual([{ kind: "paste", text: "a\nb\nc" }]);
  });

  it("splits surrounding text from the paste block", () => {
    const { tokens } = feedAll([`pre${BEGIN}body${END}post`]);
    expect(tokens).toEqual([
      { kind: "text", text: "pre" },
      { kind: "paste", text: "body" },
      { kind: "text", text: "post" },
    ]);
  });

  it("handles a paste split across multiple feeds", () => {
    const { state, tokens } = feedAll([`pre${BEGIN}bo`, "dy", `${END}post`]);
    expect(tokens).toEqual([
      { kind: "text", text: "pre" },
      { kind: "paste", text: "body" },
      { kind: "text", text: "post" },
    ]);
    expect(state.inPaste).toBe(false);
    expect(state.buffer).toBe("");
  });

  it("preserves the inPaste state when a feed ends mid-paste", () => {
    const r = feedPaste(initialPaste(), `${BEGIN}partial`);
    expect(r.tokens).toEqual([]);
    expect(r.state.inPaste).toBe(true);
    expect(r.state.buffer).toBe("partial");
  });

  it("re-entrant: another paste after a completed one works", () => {
    const { tokens } = feedAll([
      `${BEGIN}one${END}`,
      `between`,
      `${BEGIN}two${END}`,
    ]);
    expect(tokens).toEqual([
      { kind: "paste", text: "one" },
      { kind: "text", text: "between" },
      { kind: "paste", text: "two" },
    ]);
  });

  it("passes through unrelated ESC sequences as text", () => {
    const ansi = "\x1b[31mred\x1b[0m";
    const { tokens } = feedAll([ansi]);
    expect(tokens).toEqual([{ kind: "text", text: ansi }]);
  });
});
