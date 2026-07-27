import { describe, it, expect } from "vitest";
import { roundsToTimeline } from "./file-images";
import type { ReviewRoundResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";

const round = (over: Partial<ReviewRoundResponse> = {}): ReviewRoundResponse => ({
  seq: 1,
  verdict: "REJECTED",
  version: "1.0",
  reasons: ["poor_image_quality"],
  comment: "No se ve la imagen",
  reviewedBy: "reviewer",
  decidedAt: "2026-07-27T11:10:15Z",
  ...over,
});

describe("roundsToTimeline", () => {
  it("turns one round into one state change carrying its reasons and comment", () => {
    const [entry] = roundsToTimeline([round()]);

    expect(entry.kind).toBe("state_change");
    expect(entry).toMatchObject({ status: "rejected", committedBy: "reviewer" });
    if (entry.kind !== "state_change") throw new Error("expected a state change");
    expect(entry.observations).toHaveLength(1);
    expect(entry.observations[0].types).toEqual(["poor_image_quality"]);
    expect(entry.observations[0].description).toBe("No se ve la imagen");
  });

  it("keeps each round's reasons to itself", () => {
    // The defect the round model exists to fix: read out of the forum, the second
    // rejection carried the first one's codes too, because nothing recorded which
    // observation belonged to which decision.
    const entries = roundsToTimeline([
      round({ seq: 1, reasons: ["bad_lighting"], comment: "Muy oscura" }),
      round({ seq: 2, reasons: ["wrong_document"], comment: "No corresponde" }),
    ]);

    expect(entries).toHaveLength(2);
    const [first, second] = entries;
    if (first.kind !== "state_change" || second.kind !== "state_change") {
      throw new Error("expected state changes");
    }
    expect(first.observations[0].types).toEqual(["bad_lighting"]);
    expect(second.observations[0].types).toEqual(["wrong_document"]);
  });

  it("gives an approval with nothing to say no observation", () => {
    const [entry] = roundsToTimeline([
      round({ verdict: "APPROVED", reasons: [], comment: null }),
    ]);

    if (entry.kind !== "state_change") throw new Error("expected a state change");
    expect(entry.status).toBe("approved");
    expect(entry.observations).toEqual([]);
  });

  it("parses the decision time and reuses it for the observation", () => {
    const [entry] = roundsToTimeline([round()]);

    if (entry.kind !== "state_change") throw new Error("expected a state change");
    expect(entry.committedAt.toISOString()).toBe("2026-07-27T11:10:15.000Z");
    expect(entry.observations[0].createdAt).toEqual(entry.committedAt);
  });

  it("gives each round a distinct id so React does not reuse a row", () => {
    const entries = roundsToTimeline([round({ seq: 1 }), round({ seq: 2 })]);

    expect(new Set(entries.map((e) => e.id)).size).toBe(2);
  });

  it("renders content with no rounds as an empty timeline", () => {
    expect(roundsToTimeline([])).toEqual([]);
  });

  it("shows a return to review as its own entry in the history", () => {
    // Sending content back is a reversal someone performed, not the absence of a decision.
    // Treating it as nothing left the reviewer unable to undo at all.
    const entries = roundsToTimeline([
      round({ seq: 1, verdict: "REJECTED" }),
      round({ seq: 2, verdict: "PENDING", reasons: [], comment: null }),
    ]);

    expect(entries.map((e) => (e.kind === "state_change" ? e.status : null))).toEqual([
      "rejected",
      "pending",
    ]);
  });
});
