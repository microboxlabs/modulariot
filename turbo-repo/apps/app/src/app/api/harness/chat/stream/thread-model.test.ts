import { describe, expect, it } from "vitest";
import { storedThreadModel } from "./thread-model";

const offered = async () => ({
  models: ["llmgateway:deepseek-v4-flash", "claude-opus-5-5"],
});

describe("storedThreadModel", () => {
  it("uses the thread's model when it is still offered", async () => {
    expect(
      await storedThreadModel(
        async () => ({ model: "claude-opus-5-5" }),
        offered
      )
    ).toBe("claude-opus-5-5");
  });

  it("ignores a model the harness no longer offers", async () => {
    expect(
      await storedThreadModel(async () => ({ model: "retired" }), offered)
    ).toBeNull();
  });

  it("is null for a new thread or one with no model", async () => {
    expect(await storedThreadModel(async () => null, offered)).toBeNull();
    expect(
      await storedThreadModel(async () => ({ model: null }), offered)
    ).toBeNull();
  });

  it("is null when the lookup fails, so the run goes on with the default", async () => {
    const failing = async () => {
      throw new Error("modulith down");
    };
    expect(await storedThreadModel(failing, offered)).toBeNull();
  });
});
