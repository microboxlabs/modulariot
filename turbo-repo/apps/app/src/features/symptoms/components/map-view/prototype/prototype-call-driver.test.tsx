import type { PropsWithChildren } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import PrototypeCallDriver, {
  type CallFormDraft,
} from "./prototype-call-driver";

const api = vi.hoisted(() => ({
  openTreatment: vi.fn(),
  addTreatmentAction: vi.fn(),
  closeTreatment: vi.fn(),
  requestTreatment: vi.fn(),
  push: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => api);
vi.mock("@/features/common/providers/client-api.provider", () => api);
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  getRuntimeConfig: () => ({}),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: api.notify,
}));
vi.mock(
  "@/features/task-forms/components/task-confirm-modal/branded-multi-select",
  () => ({
    default: () => null,
  })
);
vi.mock("./prototype-form-kit", () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    FieldCard: Container,
    PlainSection: Container,
    StickyActions: Container,
    BentoGrid: Container,
    BentoRow: Container,
    SelectableFieldControl: () => null,
    SelectableDropdown: () => null,
    OptionsDropdown: () => null,
    GeneralInfoGrid: () => null,
    useSelectableOptions: () => ({
      options: [{ id: "driver", name: "Driver role", description: "" }],
    }),
    fieldLabel: "",
    fillTextarea: "",
  };
});

const request: TreatmentsRequest = {
  asset_id: "asset-test",
  assigned_to: "operator@example.com",
  client_id: null,
  status: "active",
  symptom_id: "-16",
  treatment_type: "",
  trip_id: "trip-test",
  treatment_id: undefined,
};
const draft: CallFormDraft = {
  selectedTagIds: [],
  callTargetId: "driver",
  targetPhone: "",
  resultadoId: "result_corrected",
  notaLlamada: "Synthetic call note",
  saved: false,
};

function renderCall(saved = false) {
  const closeMenu = vi.fn();
  render(
    <PrototypeCallDriver
      dict={es as I18nRecord}
      treatmentData={null}
      messageToCommunicate="Test message"
      setMessageToCommunicate={vi.fn()}
      treatmentRequest={request}
      setTreatmentRequest={vi.fn()}
      setIsMenuOpen={closeMenu}
      initialCallTargetName="Test contact"
      initialCallTargetPhone="+12025550100"
      initialCallTargetRole="Dispatcher"
      initialDraft={{ ...draft, saved }}
      callDurationSeconds={30}
    />
  );
  return closeMenu;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.openTreatment.mockResolvedValue({ id: "t-1", type: "CALL" });
  api.addTreatmentAction.mockResolvedValue({});
  api.closeTreatment.mockResolvedValue({});
});

describe("engine call treatment form", () => {
  it("records the selected person's identity and number rather than the role picker", async () => {
    const user = userEvent.setup();
    const closeMenu = renderCall();
    await user.click(
      screen.getByRole("button", { name: es.symptoms.save_treatment })
    );

    await waitFor(() => expect(closeMenu).toHaveBeenCalledWith(false));
    expect(api.addTreatmentAction).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        kind: "CALL",
        contactName: "Test contact",
        contactPhone: "+12025550100",
        contactRole: "Dispatcher",
        durationSeconds: 30,
        note: "Synthetic call note",
      })
    );
    expect(api.requestTreatment).not.toHaveBeenCalled();
  });

  it("keeps the form open on close failure and retries without a duplicate call action", async () => {
    const user = userEvent.setup();
    api.closeTreatment.mockRejectedValueOnce(new Error("case close failed"));
    const closeMenu = renderCall();
    const finish = screen.getByRole("button", {
      name: es.symptoms.save_treatment,
    });
    await user.click(finish);

    await waitFor(() =>
      expect(api.notify).toHaveBeenCalledWith({
        type: "error",
        message: es.symptoms.treatment_save_error,
      })
    );
    expect(closeMenu).not.toHaveBeenCalled();
    expect(api.push).not.toHaveBeenCalled();
    await user.click(finish);

    await waitFor(() => expect(closeMenu).toHaveBeenCalledWith(false));
    expect(api.openTreatment).toHaveBeenCalledTimes(1);
    expect(api.addTreatmentAction).toHaveBeenCalledTimes(1);
    expect(api.closeTreatment).toHaveBeenCalledTimes(2);
    expect(api.closeTreatment.mock.calls.map(([id]) => id)).toEqual([
      "t-1",
      "t-1",
    ]);
  });

  it("allows only one save while an action is in flight", async () => {
    const user = userEvent.setup();
    let resolveAction = () => {};
    api.addTreatmentAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAction = () => resolve({});
        })
    );
    const closeMenu = renderCall();
    const finish = screen.getByRole("button", {
      name: es.symptoms.save_treatment,
    });
    await user.dblClick(finish);

    expect(api.addTreatmentAction).toHaveBeenCalledTimes(1);
    expect(finish).toBeDisabled();
    await act(async () => resolveAction());
    await waitFor(() => expect(closeMenu).toHaveBeenCalledWith(false));
    expect(api.closeTreatment).toHaveBeenCalledTimes(1);
  });

  it("finishes an already saved draft without adding another action", async () => {
    const user = userEvent.setup();
    const closeMenu = renderCall(true);
    await user.click(
      screen.getByRole("button", { name: es.symptoms.save_treatment })
    );

    await waitFor(() => expect(closeMenu).toHaveBeenCalledWith(false));
    expect(api.addTreatmentAction).not.toHaveBeenCalled();
    expect(api.closeTreatment).toHaveBeenCalledWith("t-1", {});
  });
});
