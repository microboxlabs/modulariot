import { describe, expect, it } from "vitest";
import { levelSince } from "./level-since";

describe("levelSince", () => {
  it("takes the latest open or level change", () => {
    expect(
      levelSince([
        { kind: "OPENED", at: "2026-11-05T10:00:00Z" },
        { kind: "LEVEL_CHANGED", at: "2026-11-05T10:05:00Z" },
        { kind: "ACTION", at: "2026-11-05T10:07:00Z" },
      ])
    ).toBe(Date.parse("2026-11-05T10:05:00Z"));
  });

  it("counts from the end of a hold when it is later", () => {
    const timeline = [{ kind: "OPENED" as const, at: "2026-11-05T10:00:00Z" }];
    expect(levelSince(timeline, "2026-11-05T11:00:00Z")).toBe(
      Date.parse("2026-11-05T11:00:00Z")
    );
    expect(levelSince(timeline, "2026-11-05T09:00:00Z")).toBe(
      Date.parse("2026-11-05T10:00:00Z")
    );
  });

  it("is null without a timeline or without an open entry", () => {
    expect(levelSince(undefined)).toBeNull();
    expect(
      levelSince([{ kind: "NOTED", at: "2026-11-05T10:00:00Z" }])
    ).toBeNull();
  });
});
