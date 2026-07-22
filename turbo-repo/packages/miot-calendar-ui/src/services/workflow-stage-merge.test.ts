import { describe, it, expect } from "vitest";
import { mergeWorkflowStages } from "./workflow-stage-merge";
import type { PlannedService } from "../types/planning";

type Item = { id: string; code?: string };

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
