import { describe, expect, it } from "vitest";
import { MiotHarnessApiError } from "@microboxlabs/miot-harness-client";
import { planRefusalMessage } from "./plan-refusal";

describe("planRefusalMessage", () => {
  it("maps a plan refusal to its chat message", () => {
    const err = new MiotHarnessApiError(
      "http_402",
      undefined,
      { error: "plan_pool_exhausted", message: "used its tokens" },
      402
    );
    expect(planRefusalMessage(err)).toBe(
      "harnessChat.plan.plan_pool_exhausted"
    );
  });

  it("ignores other errors", () => {
    expect(
      planRefusalMessage(
        new MiotHarnessApiError("http_500", undefined, { error: "boom" }, 500)
      )
    ).toBeNull();
    expect(
      planRefusalMessage(
        new MiotHarnessApiError(
          "http_400",
          undefined,
          { error: "toString" },
          400
        )
      )
    ).toBeNull();
    expect(
      planRefusalMessage(
        new MiotHarnessApiError("http_502", undefined, "", 502)
      )
    ).toBeNull();
    expect(planRefusalMessage(new Error("plan_no_seat"))).toBeNull();
  });
});
