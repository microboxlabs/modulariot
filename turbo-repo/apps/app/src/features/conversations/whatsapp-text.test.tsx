import { describe, expect, it } from "vitest";
import { filled, parseWhatsApp, plainText } from "./whatsapp-text";

describe("parseWhatsApp", () => {
  it("reads bold, italic, strike and monospace, nested", () => {
    expect(parseWhatsApp("Hola *Juan _Soto_* ~no~ ```x*y```")).toEqual([
      { kind: "text", text: "Hola " },
      {
        kind: "bold",
        parts: [
          { kind: "text", text: "Juan " },
          { kind: "italic", parts: [{ kind: "text", text: "Soto" }] },
        ],
      },
      { kind: "text", text: " " },
      { kind: "strike", parts: [{ kind: "text", text: "no" }] },
      { kind: "text", text: " " },
      { kind: "mono", parts: [{ kind: "text", text: "x*y" }] },
    ]);
  });

  it("leaves marks inside words, around spaces or across lines as text", () => {
    for (const text of [
      "{{next_step}} y {{last_step}}",
      "2 * 3 * 4",
      "*uno\ndos*",
    ])
      expect(parseWhatsApp(text)).toEqual([{ kind: "text", text }]);
  });
});

describe("plainText", () => {
  it("drops the marks and keeps the variables", () => {
    expect(plainText("*Hola {{a_b}}* _ya_")).toBe("Hola {{a_b}} ya");
  });
});

describe("filled", () => {
  it("puts the values in and keeps variables without one", () => {
    expect(filled("{{a}} y {{b}}", { a: "1", b: "" })).toBe("1 y {{b}}");
  });
});
