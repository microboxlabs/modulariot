import { describe, it, expect } from "vitest";
import {
  CALENDAR_LIVE_TASK_COLUMNS,
  bookingStatusToWorkflowStage,
} from "./workflow-stage";
import { asTaskStageFromColumn } from "./task-stage-transitions";

describe("CALENDAR_LIVE_TASK_COLUMNS", () => {
  it("covers the planning segment and the post-planning active stages", () => {
    expect(CALENDAR_LIVE_TASK_COLUMNS).toEqual([
      "planService",
      "assignDriver",
      "presentDriver",
      "prepareService",
      "missionControl",
      "monitorTrip",
      "confirmArrival",
      "closeMonitoring",
    ]);
  });

  it("every column round-trips through asTaskStageFromColumn", () => {
    for (const column of CALENDAR_LIVE_TASK_COLUMNS) {
      expect(asTaskStageFromColumn(column)).toBe(column);
    }
  });
});

describe("bookingStatusToWorkflowStage", () => {
  it("maps terminal statuses to terminal stages", () => {
    expect(bookingStatusToWorkflowStage("FINISHED")).toBe("finished");
    expect(bookingStatusToWorkflowStage("CANCELLED")).toBe("cancelled");
  });

  it("maps in-course statuses onto their kanban-stage equivalents", () => {
    expect(bookingStatusToWorkflowStage("IN_TRANSIT")).toBe("monitorTrip");
    expect(bookingStatusToWorkflowStage("ARRIVED")).toBe("confirmArrival");
  });

  it("leaves planning-segment statuses and absent status unmapped", () => {
    expect(bookingStatusToWorkflowStage("PLANNED")).toBeUndefined();
    expect(bookingStatusToWorkflowStage("ASSIGNED")).toBeUndefined();
    expect(bookingStatusToWorkflowStage(undefined)).toBeUndefined();
  });
});
