import { describe, expect, it } from "vitest";
import { rejectionReasonsFrom } from "./review-rejection-reasons";
import type { RejectedItem } from "../task-bento-form/bento-review-context";

const item = (contentType?: string): RejectedItem => ({
  fileName: `${contentType ?? "unknown"}.jpg`,
  contentType,
  observations: [],
});

describe("rejectionReasonsFrom", () => {
  it("maps each reviewed content type to the code the backend expects", () => {
    expect(
      rejectionReasonsFrom([
        item("PICKUP_GUIDE_IMAGE"),
        item("PICKUP_LEFT_IMAGE"),
        item("PICKUP_RIGHT_IMAGE"),
        item("PICKUP_FRONT_IMAGE"),
        item("PICKUP_REAR_IMAGE"),
      ])
    ).toEqual([
      "REJECTED_GUIDE",
      "REJECTED_LEFT_SIDE",
      "REJECTED_RIGHT_SIDE",
      "REJECTED_FRONT",
      "REJECTED_BACK",
    ]);
  });

  it("reports a content type once however many of its documents were rejected", () => {
    expect(
      rejectionReasonsFrom([item("PICKUP_LEFT_IMAGE"), item("PICKUP_LEFT_IMAGE")])
    ).toEqual(["REJECTED_LEFT_SIDE"]);
  });

  it("emits nothing for content the backend excludes from this rejection", () => {
    // POD and load proofs are reviewable, but the mission-control rejection ignores them —
    // a code here would claim a rejection that is never acted on.
    expect(
      rejectionReasonsFrom([item("PROOF_OF_DELIVERY"), item("PROOF_OF_LOAD_FLOOR")])
    ).toEqual([]);
  });

  it("skips an item whose content type is missing rather than guessing", () => {
    expect(rejectionReasonsFrom([item(undefined), item("PICKUP_FRONT_IMAGE")])).toEqual([
      "REJECTED_FRONT",
    ]);
  });

  it("returns nothing when no document was rejected", () => {
    expect(rejectionReasonsFrom([])).toEqual([]);
  });
});
