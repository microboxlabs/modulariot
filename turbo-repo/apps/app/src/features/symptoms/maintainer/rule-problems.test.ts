import { describe, expect, it } from "vitest";
import en from "@/lang/en.json";
import type { Finding } from "./maintainer-api";
import { findingText, problemsFor } from "./rule-problems";

const d = en.pages.userSettings.symptomCatalog;

const finding = (patch: Partial<Finding>): Finding => ({
  section: "levels.4.response",
  severity: "ERROR",
  message: "El paso 1 no dice a quién contactar.",
  position: -1,
  ...patch,
});

describe("findingText", () => {
  it("translates the code with its parameters", () => {
    expect(
      findingText(finding({ code: "stepNoContact", params: { n: "1" } }), d)
    ).toBe("Step 1 does not say whom to contact.");
  });

  it("names levels and CEL types in the user's language", () => {
    expect(
      findingText(
        finding({
          code: "levelsOverlap",
          params: { levelA: "3", levelB: "4", measure: "20", held: "0" },
        }),
        d
      )
    ).toBe(
      "Critical and Code black overlap: with measure 20 and 0 s held both hold."
    );
    expect(
      findingText(
        finding({
          code: "ruleOperatorBetween",
          params: { op: ">", left: "string", right: "int" },
        }),
        d
      )
    ).toBe("“>” cannot be used between text and whole number.");
  });

  it("keeps the server's text when the code is missing or unknown", () => {
    expect(findingText(finding({}), d)).toBe(
      "El paso 1 no dice a quién contactar."
    );
    expect(findingText(finding({ code: "somethingNew" }), d)).toBe(
      "El paso 1 no dice a quién contactar."
    );
  });

  it("gives each section only its own findings", () => {
    const findings = [
      finding({ code: "stepNoContact", params: { n: "1" } }),
      finding({ section: "levels.4", code: "ruleIncomplete", position: 3 }),
    ];
    expect(problemsFor(findings, "levels.4", d)).toEqual([
      {
        position: 3,
        message: "The expression is incomplete.",
        severity: "error",
      },
    ]);
  });
});
