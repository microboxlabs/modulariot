import { describe, expect, it } from "vitest";

import { boardOfPath } from "./board-module";

describe("boardOfPath", () => {
  it("puts the Alfresco task pages in the kanban model", () => {
    for (const path of [
      "/shipping",
      "/mytasks",
      "/task/edit/42",
      "/where-is-my-load",
      "/collaborators-management",
      "/collaborators-management/123",
    ]) {
      expect(boardOfPath(path)).toBe("kanban");
    }
  });

  it("puts the trips pages in the trips model and the rest in none", () => {
    expect(boardOfPath("/trips/dispatch")).toBe("trips");
    expect(boardOfPath("/symptoms")).toBeNull();
    expect(boardOfPath("/tasks-report")).toBeNull();
  });
});
