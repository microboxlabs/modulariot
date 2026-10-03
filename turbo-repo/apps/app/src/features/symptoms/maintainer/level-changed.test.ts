import { describe, expect, it } from "vitest";
import type { SymptomSpec } from "./maintainer-api";
import { levelChanged } from "./symptom-rule-sections";
import { changedPaths } from "./ui/changed";

const level = (icu: number, when: string) => ({
  icu,
  applies: true,
  when,
  response: null,
});

const spec = (levels: ReturnType<typeof level>[]) =>
  ({ levels }) as unknown as SymptomSpec;

describe("levelChanged", () => {
  it("marks the level whose rule changed, found by ICU", () => {
    const published = spec([level(1, "medida > 0"), level(3, "medida >= 10")]);
    const draft = spec([level(1, "medida > 0"), level(3, "medida >= 12")]);
    const changed = changedPaths(draft, published);
    expect(levelChanged(draft, changed, 3)).toBe(true);
    expect(levelChanged(draft, changed, 1)).toBe(false);
    expect(levelChanged(draft, changed, 4)).toBe(false);
  });

  it("marks nothing when the draft equals the published version", () => {
    const s = spec([level(1, "medida > 0")]);
    expect(levelChanged(s, changedPaths(s, s), 1)).toBe(false);
  });
});
