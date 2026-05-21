import { describe, expect, it } from "vitest";
import { shouldUseTui } from "../../cli.js";

describe("shouldUseTui", () => {
  it("returns true when both stdin and stdout are TTYs and the env override is absent", () => {
    expect(
      shouldUseTui({}, { isTTY: true }, { isTTY: true }),
    ).toBe(true);
  });

  it("returns false when stdin is piped (isTTY = false)", () => {
    expect(
      shouldUseTui({}, { isTTY: false }, { isTTY: true }),
    ).toBe(false);
  });

  it("returns false when stdout is redirected (isTTY = false)", () => {
    expect(
      shouldUseTui({}, { isTTY: true }, { isTTY: false }),
    ).toBe(false);
  });

  it("returns false when both streams are non-TTY", () => {
    expect(
      shouldUseTui({}, { isTTY: false }, { isTTY: false }),
    ).toBe(false);
  });

  it("treats undefined isTTY as non-TTY", () => {
    expect(shouldUseTui({}, {}, {})).toBe(false);
  });

  it("respects MIOT_CHAT_NO_TUI=1 even when both streams are TTYs", () => {
    expect(
      shouldUseTui(
        { MIOT_CHAT_NO_TUI: "1" },
        { isTTY: true },
        { isTTY: true },
      ),
    ).toBe(false);
  });

  it("MIOT_CHAT_NO_TUI value other than '1' does NOT disable the TUI", () => {
    expect(
      shouldUseTui(
        { MIOT_CHAT_NO_TUI: "true" },
        { isTTY: true },
        { isTTY: true },
      ),
    ).toBe(true);
    expect(
      shouldUseTui(
        { MIOT_CHAT_NO_TUI: "0" },
        { isTTY: true },
        { isTTY: true },
      ),
    ).toBe(true);
  });
});
