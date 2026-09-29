import { describe, expect, it } from "vitest";
import { createMiotHarnessClient } from "../client.js";
import type { ModelsInfo } from "../types.js";
import { createMockFetch } from "./test-utils.js";

const MODELS: ModelsInfo = {
  default: "claude-opus-4-8",
  models: ["claude-opus-4-8", "claude-sonnet-4-6"],
};

describe("models.list", () => {
  it("GETs /models and returns the default plus the allowlist", async () => {
    const { fn, call } = createMockFetch(MODELS);
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });
    const result = await client.models.list();
    expect(result).toEqual(MODELS);
    expect(call.url).toBe("http://harness.local/models");
    expect(call.init.method).toBe("GET");
  });
});
