import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TaskConfirmModal from "./task-confirm-modal";
import {
  OUTCOME_PREPARE_SERVICE_V2,
  OUTCOME_TO_CONFIRM_ARRIVAL_V2,
  OUTCOME_TO_CONFIRM_DELIVERY_V2,
  TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK,
  TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
} from "../../services/form.service";
import { rememberKanbanView } from "@/features/shipping/services/kanban-return";
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
  reasons: [],
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

describe("TaskConfirmModal, after the move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  function renderContinue(
    props: {
      taskType?: typeof TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK;
      outcome?: typeof OUTCOME_TO_CONFIRM_DELIVERY_V2;
      lang?: string;
    } = {}
  ) {
    const setOpenModal = vi.fn();
    render(
      <TaskConfirmModal
        openModal
        setOpenModal={setOpenModal}
        commentsFieldEnabled={false}
        taskId="2984416"
        taskType={TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK}
        outcome={OUTCOME_TO_CONFIRM_ARRIVAL_V2}
        outcomeLabel="Confirmar Cierre"
        dict={dict}
        lang="es"
        {...props}
      />
    );
    return { setOpenModal };
  }

  const confirm = () =>
    userEvent.click(
      screen.getByRole("button", { name: "Confirmar mover a Confirmar Cierre" })
    );

  it("returns to the task's board in the page's locale", async () => {
    taskNextAction.mockResolvedValue({ success: true });
    renderContinue();

    await confirm();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/es/shipping"));
  });

  it("returns to a delivery task's board", async () => {
    taskNextAction.mockResolvedValue({ success: true });
    renderContinue({
      taskType: TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK,
      outcome: OUTCOME_TO_CONFIRM_DELIVERY_V2,
      lang: "en",
    });

    await confirm();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/delivery"));
  });

  it("returns to the Kanban view the task was opened from, filters included", async () => {
    rememberKanbanView("/es/finished?serviceType=CARGA");
    taskNextAction.mockResolvedValue({ success: true });
    renderContinue({ lang: "en" });

    await confirm();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/en/finished?serviceType=CARGA")
    );
  });

  it("stays on the form when the move fails", async () => {
    taskNextAction.mockResolvedValue({ success: false });
    const { setOpenModal } = renderContinue();

    await confirm();

    await waitFor(() => expect(taskNextAction).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(setOpenModal).not.toHaveBeenCalledWith(false);
  });

  it("stays on the form when the request throws", async () => {
    taskNextAction.mockRejectedValue(
      Object.assign(new Error("Bad Gateway"), {
        info: { error: { message: "Bad Gateway" } },
      })
    );
    const { setOpenModal } = renderContinue();

    await confirm();

    await waitFor(() => expect(taskNextAction).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(setOpenModal).not.toHaveBeenCalledWith(false);
  });
});
