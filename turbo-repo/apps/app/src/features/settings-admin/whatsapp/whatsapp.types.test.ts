import { describe, it, expect } from "vitest";
import {
  formatRecipientList,
  isTruthyFlag,
  parseRecipientList,
  WhatsAppConnectionSchema,
  WhatsAppEditSchema,
} from "./whatsapp.types";

describe("parseRecipientList", () => {
  it("splits on newlines and commas, trimming blanks", () => {
    expect(parseRecipientList("+56 9 1\n +56 9 2 , +56 9 3\n\n")).toEqual([
      "+56 9 1",
      "+56 9 2",
      "+56 9 3",
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseRecipientList("   \n , \n")).toEqual([]);
  });
});

describe("formatRecipientList", () => {
  it("renders a JSON array as newline-separated text", () => {
    expect(formatRecipientList(["+56 9 1", " +56 9 2 ", "", 3])).toBe(
      "+56 9 1\n+56 9 2\n3",
    );
  });

  it("normalizes a delimited string", () => {
    expect(formatRecipientList("+56 9 1, +56 9 2")).toBe("+56 9 1\n+56 9 2");
  });

  it("returns an empty string for nullish or other types", () => {
    expect(formatRecipientList(undefined)).toBe("");
    expect(formatRecipientList(null)).toBe("");
    expect(formatRecipientList(42)).toBe("");
  });

  it("round-trips with parseRecipientList", () => {
    const stored = ["+56 9 1", "+56 9 2"];
    expect(parseRecipientList(formatRecipientList(stored))).toEqual(stored);
  });
});

describe("isTruthyFlag", () => {
  it("accepts booleans and 'true' strings (case/space insensitive)", () => {
    expect(isTruthyFlag(true)).toBe(true);
    expect(isTruthyFlag("true")).toBe(true);
    expect(isTruthyFlag(" TRUE ")).toBe(true);
  });

  it("treats everything else as false", () => {
    expect(isTruthyFlag(false)).toBe(false);
    expect(isTruthyFlag("false")).toBe(false);
    expect(isTruthyFlag("yes")).toBe(false);
    expect(isTruthyFlag(undefined)).toBe(false);
    expect(isTruthyFlag(1)).toBe(false);
  });
});

describe("test-mode validation", () => {
  const base = {
    name: "WA",
    phoneNumberId: "123",
    wabaId: "456",
    graphVersion: "v25.0",
    baseUrl: "https://graph.facebook.com/v25.0",
    token: "secret",
    testModeEnabled: false,
    testRecipients: "",
  };

  it("allows test mode off with no recipients", () => {
    expect(WhatsAppConnectionSchema.safeParse(base).success).toBe(true);
  });

  it("rejects test mode on with an empty allowlist", () => {
    const result = WhatsAppConnectionSchema.safeParse({
      ...base,
      testModeEnabled: true,
      testRecipients: "  \n , ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["testRecipients"]);
      expect(result.error.issues[0]?.message).toBe(
        "validation.testRecipientsRequired",
      );
    }
  });

  it("allows test mode on with at least one recipient", () => {
    expect(
      WhatsAppConnectionSchema.safeParse({
        ...base,
        testModeEnabled: true,
        testRecipients: "+56 9 1234 5678",
      }).success,
    ).toBe(true);
  });

  it("edit schema allows a blank token", () => {
    expect(WhatsAppEditSchema.safeParse({ ...base, token: "" }).success).toBe(
      true,
    );
  });
});
