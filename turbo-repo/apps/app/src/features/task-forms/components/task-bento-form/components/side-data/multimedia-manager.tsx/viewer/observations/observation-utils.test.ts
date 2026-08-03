import { describe, it, expect } from "vitest";
import {
  isImmutable,
  isRoundObservation,
  isSilentApproval,
} from "./observation-utils";
import type {
  ObservationEntry,
  StateChangeTimelineEntry,
  TimelineEntry,
} from "./observation.types";

const note = (over: Partial<ObservationEntry> = {}): ObservationEntry => ({
  id: "obs-1",
  types: ["poor_image_quality"],
  description: "No se ve el sello",
  createdAt: new Date("2026-07-27T15:19:00Z"),
  ...over,
});

const stateChange = (
  over: Partial<StateChangeTimelineEntry> = {}
): TimelineEntry => ({
  kind: "state_change",
  id: "sc-1",
  status: "approved",
  committedAt: new Date("2026-07-27T15:19:00Z"),
  committedBy: "reviewer",
  observations: [],
  ...over,
});

describe("isSilentApproval", () => {
  it("hides an approval that carries no notes", () => {
    // The card this would render says only "Aprobado / no notes attached" — the same fact the
    // file's status badge already shows, at the cost of the panel's whole height.
    expect(isSilentApproval(stateChange())).toBe(true);
  });

  it("keeps an approval that someone wrote a note on", () => {
    expect(isSilentApproval(stateChange({ observations: [note()] }))).toBe(false);
  });

  it("keeps a rejection with no notes, because an empty one is a bug worth seeing", () => {
    // Committing a rejection requires at least one observation, so this shape should not exist.
    // Hiding it would hide the defect rather than the noise.
    expect(isSilentApproval(stateChange({ status: "rejected" }))).toBe(false);
  });

  it("keeps a pending entry, which marks content going back for another look", () => {
    expect(isSilentApproval(stateChange({ status: "pending" }))).toBe(false);
  });

  it("keeps a loose observation", () => {
    const loose: TimelineEntry = {
      kind: "observation",
      id: "loose-1",
      types: ["poor_image_quality"],
      description: "Nota suelta",
      createdAt: new Date("2026-07-27T15:19:00Z"),
    };
    expect(isSilentApproval(loose)).toBe(false);
  });
});

describe("isImmutable", () => {
  it("locks an observation that came from a review round", () => {
    expect(isImmutable(note({ source: "round" }))).toBe(true);
  });

  it("leaves a forum post editable", () => {
    expect(isImmutable(note({ source: "forum" }))).toBe(false);
  });

  it("leaves a staged draft editable — it has never been sent anywhere", () => {
    expect(isImmutable(note())).toBe(false);
  });
});

describe("isRoundObservation", () => {
  const roundDetail = note({ id: "round-1-detail", source: "round" });
  const forumPost = note({ id: "9f1c-forum-post", source: "forum" });
  const entries: TimelineEntry[] = [
    stateChange({ id: "round-1", status: "rejected", observations: [roundDetail] }),
    stateChange({ id: "sc-forum", status: "rejected", observations: [forumPost] }),
  ];

  it("recognises a round's own detail", () => {
    // The id that used to reach the forum as workspace://SpacesStore/round-1-detail.
    expect(isRoundObservation(entries, "round-1-detail")).toBe(true);
  });

  it("does not claim a forum post", () => {
    expect(isRoundObservation(entries, "9f1c-forum-post")).toBe(false);
  });

  it("does not claim an id it has never seen", () => {
    // A draft, or an entry from another file: neither is a round, so neither is refused.
    expect(isRoundObservation(entries, "obs-42")).toBe(false);
    expect(isRoundObservation([], "round-1-detail")).toBe(false);
  });
});
