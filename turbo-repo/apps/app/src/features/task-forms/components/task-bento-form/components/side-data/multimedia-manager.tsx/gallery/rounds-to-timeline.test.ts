import { describe, it, expect } from "vitest";
import { roundsToTimeline } from "./file-images";
import {
  splitByVersion,
  statusForCurrentVersion,
} from "../viewer/observations/review-version";
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

  it("carries the revision each round judged", () => {
    const entries = roundsToTimeline([
      round({ seq: 1, version: "1.0" }),
      round({ seq: 2, version: null }),
    ]);

    expect(entries.map((e) => (e.kind === "state_change" ? e.version : undefined))).toEqual([
      "1.0",
      null,
    ]);
  });
});

/**
 * A photo the driver re-sent after it was rejected.
 *
 * servicio-1633381 as the repository actually holds it: one REJECTED round against v1.0, and
 * a node sitting at v1.1 with `mintral:reviewStatus` reset to PENDING by the onsite processor.
 * The panel read the round as the current state, so the reviewer opened a photo nobody had
 * looked at and found it marked "Rechazado" with the previous reviewer's reasons attached.
 */
describe("a re-uploaded photo, end to end", () => {
  const rejectedAtV10 = roundsToTimeline([
    round({
      seq: 1,
      verdict: "REJECTED",
      version: "1.0",
      reasons: ["poor_image_quality", "wrong_format"],
      comment: "no se percibe la patente del vehículo con claridad",
      decidedAt: "2026-07-27T19:19:18.073Z",
    }),
  ]);

  it("is pending again once the content it judged has been replaced", () => {
    expect(statusForCurrentVersion(rejectedAtV10, "1.1")).toBe("pending");
  });

  it("shows nothing against the new revision, and files the rejection as history", () => {
    const { current, history } = splitByVersion(rejectedAtV10, "1.1");

    expect(current).toEqual([]);
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe("1.0");
    const [entry] = history[0].entries;
    if (entry.kind !== "state_change") throw new Error("expected a state change");
    expect(entry.status).toBe("rejected");
    // Still readable, so "why was this sent back?" is one click away rather than lost.
    expect(entry.observations[0].types).toEqual(["poor_image_quality", "wrong_format"]);
  });

  it("goes back to reading as rejected the moment someone rejects the new revision", () => {
    const decided = [...rejectedAtV10, ...roundsToTimeline([
      round({ seq: 2, verdict: "REJECTED", version: "1.1", comment: "Sigue borrosa" }),
    ])];

    expect(statusForCurrentVersion(decided, "1.1")).toBe("rejected");
    expect(splitByVersion(decided, "1.1").current).toHaveLength(1);
  });
});
