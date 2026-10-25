import { describe, expect, it } from "vitest";
import { jsonSlot, jsonStrings, parseJson } from "./json-code-editor";

describe("jsonStrings", () => {
  it("names the property of each value, and the array's for its items", () => {
    const text = `[{"channel": "email", "to": ["drivers", "tower"], "x": {"to": "a"}}]`;
    expect(
      jsonStrings(text)
        .filter((s) => !s.isKey)
        .map((s) => [s.key, s.value])
    ).toEqual([
      ["channel", "email"],
      ["to", "drivers"],
      ["to", "tower"],
      ["to", "a"],
    ]);
  });

  it("reads an escaped quote inside a string and a string still being typed", () => {
    const strings = jsonStrings(`{"name": "a \\"b\\"", "template": "pan`);
    expect(strings.map((s) => s.value)).toEqual([
      "name",
      'a "b"',
      "template",
      "pan",
    ]);
    expect(strings.at(-1)?.key).toBe("template");
  });
});

describe("jsonStrings keys", () => {
  it("gives each key the property its object sits under and the type of its value", () => {
    const text = `[{"after1": 0, "channel": ["email"], "entries": [{"role": "x"}]}]`;
    expect(
      jsonStrings(text)
        .filter((s) => s.isKey)
        .map((s) => [s.owner, s.value, s.type])
    ).toEqual([
      ["", "after1", "number"],
      ["", "channel", "array"],
      ["", "entries", "array"],
      ["entries", "role", "string"],
    ]);
  });
});

describe("jsonSlot", () => {
  it("tells a key slot, with the keys already written, from a value slot", () => {
    expect(jsonSlot(`[{"after": 0, `)).toEqual({
      kind: "key",
      owner: "",
      present: ["after"],
    });
    expect(jsonSlot(`[{"entries": [{`)).toEqual({
      kind: "key",
      owner: "entries",
      present: [],
    });
    expect(jsonSlot(`[{"channel": `)).toEqual({
      kind: "value",
      key: "channel",
    });
    expect(jsonSlot(`[{"to": ["a", `)).toEqual({ kind: "value", key: "to" });
    expect(jsonSlot(`[{"after": 0`)).toBeNull();
  });
});

describe("parseJson", () => {
  it("gives the data, or the offset of the error", () => {
    expect(parseJson("[1]")).toEqual({ ok: true, data: [1] });
    const broken = parseJson('[{"a": 1,}]');
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.offset).toBeGreaterThan(0);
  });
});
