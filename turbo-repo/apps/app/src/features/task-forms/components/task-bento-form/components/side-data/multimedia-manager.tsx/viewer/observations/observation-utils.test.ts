import { describe, it, expect } from "vitest";
import { isSilentApproval } from "./observation-utils";
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
