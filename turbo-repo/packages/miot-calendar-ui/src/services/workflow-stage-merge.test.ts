import { describe, it, expect } from "vitest";
import {
  applyItemOverlay,
  mergeItemOverlays,
  mergeWorkflowStages,
} from "./workflow-stage-merge";
import type { PlannedService } from "../types/planning";

type Item = { id: string; code?: string; client?: string };

const slot = { date: new Date("2026-07-13T00:00:00Z"), hour: 5, minutes: 0 };

function planned(
  id: string,
  workflowStage?: string
): PlannedService<Item> {
  return { service: { id, code: id }, slot, ...(workflowStage ? { workflowStage } : {}) };
}

describe("mergeWorkflowStages", () => {
  it("returns the input array untouched when no resolver is given", () => {
    const input = [planned("1"), planned("2", "finished")];
    expect(mergeWorkflowStages(input)).toBe(input);
  });

  it("overlays the resolver's stage onto matching items", () => {
    const input = [planned("1"), planned("2")];
    const out = mergeWorkflowStages(input, (item) =>
      item.id === "1" ? "monitorTrip" : undefined
    );
    expect(out[0].workflowStage).toBe("monitorTrip");
    expect(out[1].workflowStage).toBeUndefined();
  });

  it("preserves a load-time terminal stage when the resolver has no answer", () => {
    const input = [planned("1", "finished")];
    const out = mergeWorkflowStages(input, () => undefined);
    expect(out[0].workflowStage).toBe("finished");
    expect(out).toBe(input);
  });

  it("lets a live stage win over a load-time terminal stage", () => {
    const input = [planned("1", "finished")];
    const out = mergeWorkflowStages(input, () => "assignDriver");
    expect(out[0].workflowStage).toBe("assignDriver");
  });

  it("keeps item identity for unchanged entries and array identity when nothing changed", () => {
    const input = [planned("1", "monitorTrip"), planned("2")];
    const same = mergeWorkflowStages(input, (item) =>
      item.id === "1" ? "monitorTrip" : undefined
    );
    expect(same).toBe(input);

    const out = mergeWorkflowStages(input, (item) =>
      item.id === "2" ? "confirmArrival" : "monitorTrip"
    );
    expect(out[0]).toBe(input[0]);
    expect(out[1]).not.toBe(input[1]);
  });
});

describe("mergeItemOverlays", () => {
  it("returns the input array untouched when no resolver is given", () => {
    const input = [planned("1"), planned("2")];
    expect(mergeItemOverlays(input)).toBe(input);
  });

  it("overlays the resolved fields onto matching items", () => {
    const input = [planned("1"), planned("2")];
    const out = mergeItemOverlays(input, (item) =>
      item.id === "1" ? { client: "ACME" } : undefined
    );
    expect(out[0].service.client).toBe("ACME");
    expect(out[1].service.client).toBeUndefined();
  });

  it("leaves the item alone when the overlay repeats what it already has", () => {
    const input = [planned("1")];
    const out = mergeItemOverlays(input, (item) => ({ code: item.code }));
    expect(out).toBe(input);
  });

  it("ignores undefined values rather than erasing the item's own", () => {
    const input = [planned("1")];
    const out = mergeItemOverlays(input, () => ({ code: undefined }));
    expect(out).toBe(input);
    expect(out[0].service.code).toBe("1");
  });

  it("keeps identity for untouched entries and preserves the slot", () => {
    const input = [planned("1"), planned("2", "finished")];
    const out = mergeItemOverlays(input, (item) =>
      item.id === "2" ? { client: "ACME" } : undefined
    );
    expect(out[0]).toBe(input[0]);
    expect(out[1].slot).toBe(input[1].slot);
    expect(out[1].workflowStage).toBe("finished");
  });
});

describe("applyItemOverlay", () => {
  it("writes only the keys the overlay names", () => {
    const item = { id: "1", code: "1", client: "OLD" };
    const out = applyItemOverlay(item, { client: "NEW" });
    expect(out).toEqual({ id: "1", code: "1", client: "NEW" });
  });

  it("returns the item by reference when there is nothing to change", () => {
    const item: Item = { id: "1", code: "1" };
    expect(applyItemOverlay(item, undefined)).toBe(item);
    expect(applyItemOverlay(item, {})).toBe(item);
    expect(applyItemOverlay(item, { code: "1" })).toBe(item);
    expect(applyItemOverlay(item, { client: undefined })).toBe(item);
  });

  // The overlay must never stand in for the item. Host ids are not unique
  // across the lists a host draws from, so substituting a same-id object would
  // replace a live kanban service with a booking-derived one whose unnamed
  // fields are the mapper's empty defaults.
  it("keeps every field the overlay does not name", () => {
    const item = { id: "1", code: "kept", client: "OLD" };
    const out = applyItemOverlay(item, { client: "NEW" });
    expect(out.code).toBe("kept");
    expect(out.id).toBe("1");
  });
});
