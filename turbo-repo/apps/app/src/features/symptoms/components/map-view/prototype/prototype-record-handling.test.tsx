import type { PropsWithChildren } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import PrototypeRecordHandling from "./prototype-record-handling";

const api = vi.hoisted(() => ({
  openTreatment: vi.fn(),
  addTreatmentAction: vi.fn(),
  closeTreatment: vi.fn(),
  requestTreatment: vi.fn(),
  revalidateCase: vi.fn(),
  push: vi.fn(),
  notify: vi.fn(),
}));

const OUTCOMES = [
  { id: "handling_outcome_1", name: "Verificado por GPS", description: "" },
  { id: "handling_outcome_3", name: "Otro", description: "" },
];

let selectableOptions = OUTCOMES;

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => api);
vi.mock("@/features/common/providers/client-api.provider", () => api);
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  getRuntimeConfig: () => ({}),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: api.push }),
  useParams: () => ({ lang: "es" }),
}));
vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: api.notify,
}));
vi.mock("./prototype-form-kit", () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    FieldCard: Container,
    PlainSection: Container,
    StickyActions: Container,
    BentoGrid: Container,
    SelectableFieldControl: () => null,
    SelectableDropdown: ({
      value,
      onSelect,
    }: {
      value: string;
      onSelect: (o: (typeof OUTCOMES)[number]) => void;
    }) => (
      <select
        aria-label="outcome"
        value={value}
        onChange={(e) => {
          const ids = e.target.value.split(",");
          onSelect({
            id: e.target.value,
            name: OUTCOMES.filter((o) => ids.includes(o.id))
              .map((o) => o.name)
              .join(", "),
            description: "",
          });
        }}
      >
        <option value="" />
        {OUTCOMES.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
        <option value={OUTCOMES.map((o) => o.id).join(",")}>
          Both outcomes
        </option>
      </select>
    ),
    GeneralInfoGrid: () => null,
    useSelectableOptions: () => ({ options: selectableOptions }),
    fieldLabel: "",
    fillTextarea: "",
  };
});

const engineCase: TreatmentsRequest = {
  asset_id: "asset-test",
  assigned_to: "operator@example.com",
  client_id: null,
  status: "active",
  symptom_id: "-16",
  treatment_type: "",
  trip_id: "trip-test",
  treatment_id: undefined,
};

function renderForm(request = engineCase) {
  const closeMenu = vi.fn();
  const form = () => (
    <PrototypeRecordHandling
      dict={es as I18nRecord}
      treatmentData={null}
      treatmentRequest={request}
      setTreatmentRequest={vi.fn()}
      setIsMenuOpen={closeMenu}
    />
  );
  const { rerender } = render(form());
  return { closeMenu, refreshOptions: () => rerender(form()) };
}

const saveButton = () =>
  screen.getByRole("button", { name: "Guardar y cerrar como gestionado" });

beforeEach(() => {
  vi.clearAllMocks();
  selectableOptions = OUTCOMES;
  api.openTreatment.mockResolvedValue({ id: "t-1", type: "CALL" });
  api.addTreatmentAction.mockResolvedValue({});
  api.closeTreatment.mockResolvedValue({});
  api.requestTreatment.mockImplementation(async (p) => ({
    ...p,
    treatment_id: 7,
  }));
});

describe("Registrar gestión", () => {
  it("needs an outcome and a note before it saves", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(saveButton()).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("outcome"), [
      "handling_outcome_1",
    ]);
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("La nota es obligatoria")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nota *"), "   ");
    expect(saveButton()).toBeDisabled();
    await user.type(screen.getByLabelText("Nota *"), "Detenido en descanso");
    expect(saveButton()).toBeEnabled();
  });

  it("stores a NOTE with the outcome and note and closes the engine case as handled", async () => {
    const user = userEvent.setup();
    const { closeMenu } = renderForm();

    await user.selectOptions(screen.getByLabelText("outcome"), [
      "handling_outcome_1",
    ]);
    await user.type(screen.getByLabelText("Nota *"), " Detenido en descanso ");
    await user.click(saveButton());

    await waitFor(() => expect(closeMenu).toHaveBeenCalledWith(false));
    expect(api.openTreatment).toHaveBeenCalledWith("-16", {
      type: "CALL",
      assetId: "asset-test",
      tripId: "trip-test",
    });
    const [treatmentId, action] = api.addTreatmentAction.mock.calls[0];
    expect(treatmentId).toBe("t-1");
    expect(action).toMatchObject({
      kind: "NOTE",
      outcomeKey: "handling_outcome_1",
      outcomeLabel: "Verificado por GPS",
      note: "Detenido en descanso",
    });
    expect(action.contactName).toBeUndefined();
    expect(api.closeTreatment).toHaveBeenCalledWith("t-1", {
      resolution: "Gestión: Verificado por GPS · Nota: Detenido en descanso",
    });
    expect(api.requestTreatment).not.toHaveBeenCalled();
    expect(api.push).toHaveBeenCalledWith("/es/symptoms");
    expect(api.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" })
    );
  });

  it("saves a case outside the engine as a 'registrar gestion' treatment", async () => {
    const user = userEvent.setup();
    renderForm({ ...engineCase, symptom_id: "42" });

    await user.selectOptions(screen.getByLabelText("outcome"), [
      "handling_outcome_3",
    ]);
    await user.type(screen.getByLabelText("Nota *"), "Aviso por radio");
    await user.click(saveButton());

    await waitFor(() => expect(api.requestTreatment).toHaveBeenCalled());
    expect(api.requestTreatment).toHaveBeenCalledWith(
      expect.objectContaining({
        symptom_id: "42",
        status: "active",
        treatment_type: "registrar gestion",
        description: "Gestión: Otro · Nota: Aviso por radio",
        driver_response: "Aviso por radio",
      })
    );
    expect(api.addTreatmentAction).not.toHaveBeenCalled();
  });

  it("keeps the form open and says so when the save fails", async () => {
    api.closeTreatment.mockRejectedValue(new Error("409"));
    const user = userEvent.setup();
    const { closeMenu } = renderForm();

    await user.selectOptions(screen.getByLabelText("outcome"), [
      "handling_outcome_1",
    ]);
    await user.type(screen.getByLabelText("Nota *"), "Revisado");
    await user.click(saveButton());

    await waitFor(() =>
      expect(api.notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" })
      )
    );
    expect(closeMenu).not.toHaveBeenCalled();
    expect(saveButton()).toBeEnabled();
  });

  it("requires an outcome from the currently bound list", async () => {
    const user = userEvent.setup();
    const { refreshOptions } = renderForm();
    await user.selectOptions(screen.getByLabelText("outcome"), [
      "handling_outcome_1",
    ]);
    await user.type(screen.getByLabelText("Nota *"), "Revisado");
    expect(saveButton()).toBeEnabled();

    selectableOptions = [];
    refreshOptions();

    expect(saveButton()).toBeDisabled();
    expect(api.addTreatmentAction).not.toHaveBeenCalled();
  });

  it("retries a failed close without adding a duplicate handling record", async () => {
    api.closeTreatment.mockRejectedValueOnce(new Error("503"));
    const user = userEvent.setup();
    const { closeMenu } = renderForm();
    await user.selectOptions(screen.getByLabelText("outcome"), [
      "handling_outcome_1",
    ]);
    await user.type(screen.getByLabelText("Nota *"), "Revisado");
    await user.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());

    await waitFor(() => expect(closeMenu).toHaveBeenCalledWith(false));
    expect(api.openTreatment).toHaveBeenCalledTimes(1);
    expect(api.addTreatmentAction).toHaveBeenCalledTimes(1);
    expect(api.closeTreatment).toHaveBeenCalledTimes(2);
  });

  it("stores the labels when bound to a multiple-selection list", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByLabelText("outcome"), [
      "handling_outcome_1,handling_outcome_3",
    ]);
    await user.type(screen.getByLabelText("Nota *"), "Revisado");
    await user.click(saveButton());

    await waitFor(() => expect(api.addTreatmentAction).toHaveBeenCalled());
    expect(api.addTreatmentAction).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        outcomeKey: "handling_outcome_1,handling_outcome_3",
        outcomeLabel: "Verificado por GPS, Otro",
      })
    );
  });
});
