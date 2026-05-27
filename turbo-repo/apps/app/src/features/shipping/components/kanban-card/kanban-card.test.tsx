import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import KanbanCard from "./kanban-card";
import type { KanbanBoardTask } from "../../types/common.types";

const useServiceCategoryName = vi.fn();

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useServiceCategoryName: (code: string | null | undefined) =>
    useServiceCategoryName(code),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement("img", props),
}));

function makeTask(overrides: Partial<KanbanBoardTask> = {}): KanbanBoardTask {
  return {
    id: "task-1",
    name: "SVC-001",
    description: "",
    completed: false,
    daysLeft: 0,
    serviceKind: "",
    serviceType: "",
    executionType: "",
    members: [],
    hoReference: "",
    isEditable: true,
    ...overrides,
  };
}

function renderCompactCard(task: KanbanBoardTask) {
  return render(
    <KanbanCard task={task} table_name="board" compactKanbanView dict={{}} />
  );
}

describe("KanbanCard service category / faena indicator", () => {
  beforeEach(() => {
    useServiceCategoryName.mockReset();
    useServiceCategoryName.mockReturnValue({
      name: undefined,
      isLoading: false,
    });
  });

  it("shows the F indicator for faena services without a category", () => {
    renderCompactCard(makeTask({ executionType: "F" }));
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("does not show the F indicator for non-faena services", () => {
    renderCompactCard(makeTask({ executionType: "T" }));
    expect(screen.queryByText("F")).not.toBeInTheDocument();
  });

  it("replaces the F indicator with the category initials when a category is set", () => {
    useServiceCategoryName.mockReturnValue({
      name: "Servicio Programado",
      isLoading: false,
    });
    renderCompactCard(
      makeTask({ executionType: "F", mintral_serviceCategory: "ST001" })
    );
    expect(screen.getByText("SP")).toBeInTheDocument();
    expect(screen.queryByText("F")).not.toBeInTheDocument();
  });

  it("does not fall back to F while the category is still resolving", () => {
    // Category code present but catalog not yet loaded → render nothing, not "F".
    renderCompactCard(
      makeTask({ executionType: "F", mintral_serviceCategory: "ST001" })
    );
    expect(screen.queryByText("F")).not.toBeInTheDocument();
    expect(screen.queryByText("SP")).not.toBeInTheDocument();
  });
});
