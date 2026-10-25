import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { completions, type JsonKeys } from "./json-code-editor";

const KEYS: JsonKeys = {
  objects: {
    "": [
      { label: "after", type: "number" },
      { label: "connection", type: "string" },
      { label: "onReply", type: "string" },
    ],
  },
  unknown: (k) => k,
  wrongType: (k) => k,
};
const VALUES = {
  onReply: { options: [{ label: "stop" }, { label: "continue" }] },
};
const DOC = `[\n  {\n    "after": 0,\n    "onReply": "continue",\n    "wa": 0,\n    \n  }\n]`;

function complete(pos: number, doc = DOC) {
  const result = completions(() => ({ values: VALUES, keys: KEYS }))(
    new CompletionContext(EditorState.create({ doc }), pos, true)
  );
  return (
    result && {
      from: result.from,
      labels: result.options.map((o) => o.label),
    }
  );
}

describe("completions", () => {
  it("offers the keys an object lacks, inside a key and on an empty line", () => {
    const inKey = DOC.indexOf('"wa"') + 1;
    expect(complete(inKey)).toEqual({
      from: inKey,
      labels: ["connection"],
    });
    const blank = DOC.indexOf("    \n") + 4;
    expect(complete(blank)?.labels).toEqual(["connection"]);
  });

  it("filters values only by the text before the cursor", () => {
    const start = DOC.indexOf('"continue"') + 1;
    expect(complete(start)).toEqual({
      from: start,
      labels: ["stop", "continue"],
    });
  });

  it("offers a key already used in a different object", () => {
    const doc = '[{"connection":"first"},{"co":"second"}]';
    expect(complete(doc.indexOf('"co"') + 1, doc)?.labels).toContain(
      "connection"
    );
  });
});
