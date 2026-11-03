import { describe, expect, it } from "vitest";
import { completionContext, macroVariables } from "./cel-completion-context";

describe("CEL completion context", () => {
  it("ignores macro examples inside strings", () => {
    expect(
      macroVariables('"signal.frame.events.exists(e, e.event_type)"').size
    ).toBe(0);
  });

  it("recognizes empty and unfinished quoted values", () => {
    for (const suffix of ['== "', '!= "gps', 'in ["x", "gps']) {
      const { quoted } = completionContext(
        `signal.frame.events.exists(e, e.event_type ${suffix}`
      );
      expect(quoted?.path).toBe("signal.frame.events.event_type");
    }
  });

  it("keeps escaped closing quotes inside the value", () => {
    const text = 'signal.frame.events.exists(e, e.event_type == "code\\"';
    expect(completionContext(text).quoted?.typed).toBe('code\\"');
    expect(completionContext(`${text}")`).quoted).toBeNull();
  });

  it("handles long nonmatching input without binding a variable", () => {
    expect(macroVariables("a".repeat(100_000)).size).toBe(0);
    expect(completionContext("a".repeat(100_000)).quoted).toBeNull();
  });
});
