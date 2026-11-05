import { describe, expect, it } from "vitest";
import type { JsonKeys } from "@/features/common/components/json-code-editor";
import { isObjectList } from "./spec-code";

const groupKeys: JsonKeys = {
  objects: {
    "": [
      { label: "id", type: "string" },
      { label: "name", type: "string" },
      { label: "entries", type: "array" },
    ],
    entries: [{ label: "role", type: "string" }],
  },
  unknown: (key) => key,
  wrongType: (key) => key,
};

describe("isObjectList", () => {
  it("keeps malformed nested groups out of the form", () => {
    expect(isObjectList([{ id: "g", name: 42, entries: [] }], groupKeys)).toBe(
      false
    );
    expect(isObjectList([{ id: "g", entries: [null] }], groupKeys)).toBe(false);
    expect(
      isObjectList([{ id: "g", entries: [{ role: 42 }] }], groupKeys)
    ).toBe(false);
    expect(isObjectList([{ entries: [] }], groupKeys)).toBe(false);
    expect(
      isObjectList([{ id: "g", entries: [{ role: "driver" }] }], groupKeys)
    ).toBe(true);
  });
});
