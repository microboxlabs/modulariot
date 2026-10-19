import { describe, expect, it } from "vitest";
import { createMiotHarnessClient } from "../client.js";
import { createMockFetch } from "./test-utils.js";

describe("titles.create", () => {
  it("POSTs the first exchange to /titles and returns the title", async () => {
    const { fn, call } = createMockFetch({ title: "Trips by region" });
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });

    const result = await client.titles.create({
      message: "trips?",
      answer: "12 trips",
    });

    expect(result).toEqual({ title: "Trips by region" });
    expect(call.url).toBe("http://harness.local/titles");
    expect(call.init.method).toBe("POST");
    expect(JSON.parse(call.init.body as string)).toEqual({
      message: "trips?",
      answer: "12 trips",
    });
  });
});
