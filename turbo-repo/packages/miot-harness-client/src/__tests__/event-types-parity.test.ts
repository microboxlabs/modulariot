import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HARNESS_EVENT_TYPES } from "../types.js";

/**
 * Schema-sync guard: the TS HarnessEventType literal union and the
 * Python `HarnessEventType` Literal must agree. Both sides validate
 * against the shared `event_types.json` fixture so adding a literal
 * on one side without the other fails CI loudly.
 *
 * Path crosses repo packages — this works in-tree because
 * miot-harness/ and turbo-repo/ are siblings in the modulariot
 * repo. In a packaged consumer build this test wouldn't run anyway.
 */
describe("HARNESS_EVENT_TYPES parity with Python", () => {
  it("matches the shared event_types.json fixture", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const fixturePath = resolve(
      here,
      "../../../../..",
      "miot-harness/src/miot_harness/runtime/event_types.json",
    );
    const payload = JSON.parse(readFileSync(fixturePath, "utf-8")) as {
      event_types: string[];
    };
    expect(new Set(HARNESS_EVENT_TYPES)).toEqual(new Set(payload.event_types));
  });
});
