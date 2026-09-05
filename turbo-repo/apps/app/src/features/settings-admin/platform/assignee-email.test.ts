import { describe, expect, it } from "vitest";

import { isPlausibleEmail, MAX_ASSIGNEE_LENGTH } from "./assignee-email";

describe("isPlausibleEmail", () => {
  it.each([
    "person@example.com",
    "first.last@sub.example.co.uk",
    "someone+tag@example.test",
    "a@b.c",
  ])("accepts %s", (value) => {
    expect(isPlausibleEmail(value)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["no at", "person.example.com"],
    ["nothing before the at", "@example.com"],
    ["nothing after the at", "person@"],
    ["two ats", "person@else@example.com"],
    ["no dot in the host", "person@example"],
    ["host starts with a dot", "person@.example"],
    ["host ends with a dot", "person@example."],
    ["inner whitespace", "person name@example.com"],
    ["trailing whitespace", "person@example.com "],
  ])("rejects %s", (_label, value) => {
    expect(isPlausibleEmail(value)).toBe(false);
  });

  it("rejects an address the person_id column could not hold", () => {
    const host = "@example.com";
    const local = "a".repeat(MAX_ASSIGNEE_LENGTH - host.length + 1);

    expect(isPlausibleEmail(local + host)).toBe(false);
    expect(isPlausibleEmail(local.slice(0, -1) + host)).toBe(true);
  });

  it("answers a long near-miss without super-linear backtracking", () => {
    // The pattern this replaced took seconds on this input.
    const started = performance.now();
    expect(isPlausibleEmail(`a@${"b".repeat(50_000)}`)).toBe(false);
    expect(performance.now() - started).toBeLessThan(100);
  });
});
