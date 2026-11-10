import { beforeEach, describe, expect, it } from "vitest";
import { kanbanReturnHref, rememberKanbanView } from "./kanban-return";

describe("kanbanReturnHref", () => {
  beforeEach(() => sessionStorage.clear());

  it("falls back to the task's board in the given locale", () => {
    expect(kanbanReturnHref("es", "/delivery")).toBe("/es/delivery");
  });

  it("returns to the remembered view with its filters, in the current locale", () => {
    rememberKanbanView("/es/planning?serviceType=CARGA&search=12");
    expect(kanbanReturnHref("en", "/shipping")).toBe(
      "/en/planning?serviceType=CARGA&search=12"
    );
  });

  it("ignores pages that are not a Kanban view", () => {
    rememberKanbanView("/es/task/edit/2984416");
    rememberKanbanView("/es/symptoms");
    rememberKanbanView("https://example.com/es/shipping");
    expect(kanbanReturnHref("es", "/shipping")).toBe("/es/shipping");
  });

  it("ignores a stored value it did not write", () => {
    sessionStorage.setItem("miot:kanban-return", "//example.com/es/shipping");
    expect(kanbanReturnHref("es", "/shipping")).toBe("/es/shipping");
  });
});
