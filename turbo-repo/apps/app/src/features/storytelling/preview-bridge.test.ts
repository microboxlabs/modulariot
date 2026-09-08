import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { BRIDGE_SOURCE, PREVIEW_BRIDGE_SCRIPT, jsonForInlineScript } from "./preview-bridge";

describe("PREVIEW_BRIDGE_SCRIPT", () => {
  it("is syntactically valid standalone JS", () => {
    expect(() => new vm.Script(PREVIEW_BRIDGE_SCRIPT)).not.toThrow();
  });

  it("carries the wire-protocol source tag", () => {
    expect(PREVIEW_BRIDGE_SCRIPT).toContain(JSON.stringify(BRIDGE_SOURCE));
  });
});

describe("jsonForInlineScript", () => {
  const roundtrip = (raw: string) =>
    new vm.Script(`JSON.parse(${jsonForInlineScript(raw)})`).runInNewContext();

  it("round-trips ordinary JSON through JSON.parse", () => {
    const raw = JSON.stringify({ RAW: { rows: [[1, 2, 3]] }, CO: {} });
    expect(roundtrip(raw)).toEqual(JSON.parse(raw));
  });

  it("neutralises </script> and HTML comment openers", () => {
    const raw = JSON.stringify({ note: "</script><!-- & < >" });
    const escaped = jsonForInlineScript(raw);
    expect(escaped).not.toMatch(/<\/script/i);
    expect(escaped).not.toContain("<!--");
    expect(roundtrip(raw)).toEqual(JSON.parse(raw));
  });

  it("escapes the U+2028 / U+2029 line terminators", () => {
    const ls = String.fromCharCode(0x2028);
    const ps = String.fromCharCode(0x2029);
    const raw = JSON.stringify({ s: `a${ls}b${ps}c` });
    const escaped = jsonForInlineScript(raw);
    expect(escaped).not.toContain(ls);
    expect(escaped).not.toContain(ps);
    expect(roundtrip(raw)).toEqual(JSON.parse(raw));
  });
});
