import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TaskConfirmModal from "./task-confirm-modal";
import {
  OUTCOME_PREPARE_SERVICE_V2,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
} from "../../services/form.service";
import type { RejectedItem } from "../task-bento-form/bento-review-context";

const { taskNextAction, push } = vi.hoisted(() => ({
  taskNextAction: vi.fn(),
  push: vi.fn(),
}));

vi.mock("../../services/client-form.service", () => ({ taskNextAction }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useLiveETA: () => ({ eta: undefined }),
}));

const dict = {
  modal: {
    title: "Estás moviendo la tarea",
    subtitle: "No podrás deshacerlo",
    title2: "Posibles motivos:",
    reason: "Motivo",
    confirm: "Confirmar mover a {outcome}",
    selectOptions: "Seleccionar opciones",
  },
  outcome: {
    continueModalApprovedCount_one: "1 documento aprobado",
    continueModalApprovedCount: "{count} documentos aprobados",
    goBackModalRejectedCount_one: "1 documento rechazado",
    goBackModalRejectedCount: "{count} documentos rechazados",
    goBackModalNoMotives: "Sin observaciones",
  },
};

const rejected = (contentType: string): RejectedItem => ({
  fileName: `${contentType}.jpg`,
  contentType,
  observations: [],
});

function renderModal(rejectedItems: RejectedItem[]) {
  return render(
    <TaskConfirmModal
      openModal
      setOpenModal={vi.fn()}
      commentsFieldEnabled
      taskId="2984416"
      taskType={TYPE_WFSHIP2_MISSION_CONTROL_TASK}
      outcome={OUTCOME_PREPARE_SERVICE_V2}
      outcomeLabel="Controlar Servicio"
      dict={dict}
      approvedItems={[]}
      rejectedItems={rejectedItems}
    />
  );
}

/** Reads the FormData the modal submitted, as a plain object. */
function submittedPayload() {
  const formData = taskNextAction.mock.calls[0][1] as FormData;
  return Object.fromEntries(formData.entries());
}

describe("TaskConfirmModal, sending a service back for control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskNextAction.mockResolvedValue({ success: true });
  });

  it("asks for nothing the review already answered", async () => {
    renderModal([rejected("PICKUP_LEFT_IMAGE")]);

    expect(screen.queryByText("Posibles motivos:")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("1 documento rechazado")).toBeInTheDocument();
  });

  it("derives the rejection codes from the reviewed documents", async () => {
    renderModal([rejected("PICKUP_LEFT_IMAGE"), rejected("PICKUP_RIGHT_IMAGE")]);

    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar mover a Controlar Servicio" })
    );

    await waitFor(() => expect(taskNextAction).toHaveBeenCalled());
    const payload = submittedPayload();
    expect(JSON.parse(payload.reasons as string)).toEqual([
      "REJECTED_LEFT_SIDE",
      "REJECTED_RIGHT_SIDE",
    ]);
    expect(payload.isMultiReason).toBe("true");
  });

  it("still asks for a motive when no document was rejected", () => {
    // Nothing in the review explains the move, so the operator has to say why —
    // dropping the inputs here would leave the transition with no reason at all.
    renderModal([]);

    expect(screen.getByText("Posibles motivos:")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
