import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearnedKnowledgePanel from "./learned-knowledge-panel";

const { state, review, edit, remove } = vi.hoisted(() => ({
  state: { isTrainer: true },
  review: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock("../hooks/use-knowledge-trainer", () => ({
  useKnowledgeTrainer: () => ({ isTrainer: state.isTrainer, isLoading: false }),
}));

vi.mock("../hooks/use-knowledge-candidates", () => ({
  useKnowledgeCandidates: () => ({
    candidates: [
      {
        id: "c1",
        connection: "sales",
        term: "orders",
        kind: null,
        scope: "tenant",
        confidence: null,
        body: "confirmed orders only",
        status: "pending",
        createdBy: "u",
        reviewedBy: null,
      },
    ],
    isLoading: false,
    error: null,
    reviewing: null,
    review,
    edit,
    refetch: vi.fn(),
  }),
}));

const cardsHook = vi.fn();
vi.mock("../hooks/use-knowledge-cards", () => ({
  useKnowledgeCards: (enabled: boolean) => cardsHook(enabled),
}));

const dict = {
  learnedKnowledge: {
    title: "Learned knowledge",
    description: "Description",
    empty: "Empty",
    error: "Error",
    retry: "Retry",
    approve: "Approve",
    reject: "Dismiss",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    termLabel: "Term",
    bodyLabel: "Meaning",
    pendingTitle: "Pending review",
    readOnly: "Only trainers can review.",
    factsTitle: "Learned facts",
    factsDescription: "Facts",
    factsEmpty: "No facts",
    factsError: "Facts error",
    factsConnectionError: "Connection error",
    factsReadOnly: "Only trainers can see facts.",
    delete: "Delete",
    confirmDelete: "Confirm delete",
    toast: {},
  },
};

describe("LearnedKnowledgePanel", () => {
  beforeEach(() => {
    state.isTrainer = true;
    review.mockReset();
    edit.mockReset();
    remove.mockReset();
    cardsHook.mockReset();
    cardsHook.mockReturnValue({
      connections: [
        {
          connection: "sales",
          cards: [
            {
              id: "card-1",
              title: null,
              term: "revenue",
              kind: "metric",
              scope: "tenant",
              body: "net of returns",
              updated_at: null,
            },
          ],
        },
      ],
      isLoading: false,
      error: null,
      deleting: null,
      remove,
      refetch: vi.fn(),
    });
  });

  it("shows trainers the review actions and the learned facts", async () => {
    review.mockResolvedValue({ cardApplied: true });
    render(<LearnedKnowledgePanel dict={dict} />);

    expect(cardsHook).toHaveBeenCalledWith(true);
    expect(screen.getByText("net of returns")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Approve/ }));
    expect(review).toHaveBeenCalledWith("c1", "approve");
  });

  it("edits a pending candidate before review", async () => {
    edit.mockResolvedValue(undefined);
    render(<LearnedKnowledgePanel dict={dict} />);

    await userEvent.click(screen.getByRole("button", { name: /Edit/ }));
    const term = screen.getByLabelText("Term");
    await userEvent.clear(term);
    await userEvent.type(term, "net orders");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(edit).toHaveBeenCalledWith("c1", {
      term: "net orders",
      body: "confirmed orders only",
    });
  });

  it("deletes a fact only after a confirming second click", async () => {
    remove.mockResolvedValue(undefined);
    render(<LearnedKnowledgePanel dict={dict} />);

    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /Confirm delete/ })
    );
    expect(remove).toHaveBeenCalledWith("sales", "card-1");
  });

  it("is read-only for non-trainers", () => {
    state.isTrainer = false;
    render(<LearnedKnowledgePanel dict={dict} />);

    expect(cardsHook).toHaveBeenCalledWith(false);
    expect(screen.getByText("confirmed orders only")).toBeInTheDocument();
    expect(screen.getByText("Only trainers can review.")).toBeInTheDocument();
    expect(
      screen.getByText("Only trainers can see facts.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
    expect(screen.queryByText("net of returns")).toBeNull();
  });
});
