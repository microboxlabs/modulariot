import { describe, expect, it } from "vitest";
import type { SymptomSpec } from "./maintainer-api";
import { changedLevels } from "./symptom-rule-sections";

const level = (icu: number, when: string) => ({
  icu,
  applies: true,
  when,
  response: null,
});

const spec = (levels: ReturnType<typeof level>[]) =>
  ({ levels }) as unknown as SymptomSpec;

describe("changedLevels", () => {
  it("marks the level whose rule changed", () => {
    const published = spec([level(1, "medida > 0"), level(3, "medida >= 10")]);
    const draft = spec([level(1, "medida > 0"), level(3, "medida >= 12")]);
    expect([...changedLevels(draft, published)]).toEqual([3]);
  });

  it("matches levels by ICU, so adding or removing one marks only that one", () => {
    const published = spec([level(1, "a"), level(3, "c")]);
    expect([
      ...changedLevels(
        spec([level(1, "a"), level(2, "b"), level(3, "c")]),
        published
      ),
    ]).toEqual([2]);
    expect([...changedLevels(spec([level(3, "c")]), published)]).toEqual([1]);
  });

  it("marks nothing when equal or before the first version", () => {
    const s = spec([level(1, "a")]);
    expect(changedLevels(s, s).size).toBe(0);
    expect(changedLevels(s, null).size).toBe(0);
  });
});
