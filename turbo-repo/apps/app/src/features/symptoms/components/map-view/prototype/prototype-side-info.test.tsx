import type { PropsWithChildren } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { SelectedOption } from "../../../types/side-info";
import es from "@/lang/es.json";
import PrototypeSideInfo from "./prototype-side-info";

const config = vi.hoisted(() => ({ pastForms: false }));

vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => ({
    SYMPTOMS_PAST_FORMS: config.pastForms ? "true" : "false",
  }),
}));
vi.mock("../../../../common/providers/client-api.provider", () => ({
  useTreatmentsTemplates: () => ({ treatments_templates: { data: {} } }),
}));
vi.mock("@/features/auth/components/access-allowed", () => ({
  AccessAllowed: ({ children }: PropsWithChildren) => <>{children}</>,
}));
vi.mock("../timeline", () => ({ default: () => <p>Timeline</p> }));
vi.mock("../../blurrable-stepped-menu/symptom-form", () => ({
  default: () => <p>Past modal</p>,
}));
vi.mock("./prototype-inline-form", () => ({
  default: ({ selectedOption }: { selectedOption: string }) => (
    <p>Inline form {selectedOption}</p>
  ),
}));

type SymptomInfo = TreatmentsGeneralResponseItem["symptom_info"];

function renderPanel(
  selectedOption: SelectedOption,
  isFormOpen: boolean,
  symptomId: number | null = -16,
  state: Partial<SymptomInfo> = {}
) {
  const setSelectedOption = vi.fn();
  const setIsFormOpen = vi.fn();
  const treatmentData: TreatmentsGeneralResponseItem | null =
    symptomId === null
      ? null
      : {
          conditions_agg: [],
          symptom_info: {
            id: symptomId,
            name: "Test condition",
            type: "test",
            icu_code: 1,
            icu_condition: "test",
            ...state,
          },
          trip_info: {
            asset_id: "asset-test",
            carrier: "",
            destination: "",
            driver: "",
            trip_id: "",
            origin: "",
            type_load: "",
            driver_contact: "",
          },
        };
  const props = {
    dict: es as I18nRecord,
    treatmentData,
    loading: false,
    error: null,
    setSelectedTreatment: vi.fn(),
    setSelectedTreatmentIndex: vi.fn(),
    isFormOpen,
    setIsFormOpen,
    selectedOption,
    setSelectedOption,
  };
  const view = render(
    <PrototypeSideInfo
      dict={es as I18nRecord}
      treatmentData={treatmentData}
      loading={false}
      error={null}
      setSelectedTreatment={vi.fn()}
      setSelectedTreatmentIndex={vi.fn()}
      isFormOpen={isFormOpen}
      setIsFormOpen={setIsFormOpen}
      selectedOption={selectedOption}
      setSelectedOption={setSelectedOption}
    />
  );
  return {
    setSelectedOption,
    setIsFormOpen,
    update: (state: Partial<SymptomInfo>, formOpen = isFormOpen) => {
      view.rerender(
        <PrototypeSideInfo
          {...props}
          isFormOpen={formOpen}
          treatmentData={
            treatmentData && {
              ...treatmentData,
              symptom_info: { ...treatmentData.symptom_info, ...state },
            }
          }
        />
      );
    },
  };
}

beforeEach(() => {
  config.pastForms = false;
});

function openOtherOptions() {
  fireEvent.click(screen.getByRole("button", { name: /Otras opciones/ }));
}

describe("the case panel by treatment state", () => {
  const open = {
    id: "t-1",
    status: "OPEN" as const,
    opened_by: "operator-a",
    opened_at: "2026-01-01T00:05:00Z",
    operators: ["operator-a"],
  };

  function expectNoActions() {
    expect(screen.queryByRole("button", { name: /Llamar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Otras opciones/ })).toBeNull();
  }

  it("says who treats the case and offers no second treatment", () => {
    renderPanel("call_driver", false, -16, {
      treatment_state: "in_treatment",
      treatment: { ...open, mine: false },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "operator-a está tratando este caso"
    );
    expectNoActions();
  });

  it("does not open a form from the URL on a case another operator treats", () => {
    const { setIsFormOpen } = renderPanel("call_driver", true, -16, {
      treatment_state: "in_treatment",
      treatment: { ...open, mine: false },
    });
    expect(setIsFormOpen).toHaveBeenCalledWith(false);

    expect(screen.queryByText(/Inline form/)).toBeNull();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("locks an open form as soon as another operator takes the case", () => {
    const { update, setIsFormOpen } = renderPanel("call_driver", true);
    expect(screen.getByText("Inline form call_driver")).toBeInTheDocument();
    update({
      treatment_state: "in_treatment",
      treatment: { ...open, mine: false },
    });
    expect(screen.queryByText(/Inline form/)).toBeNull();
    expect(setIsFormOpen).toHaveBeenCalledWith(false);
  });

  it("keeps only its own episode mounted while its save closes the case", () => {
    const { update, setIsFormOpen } = renderPanel("call_driver", true, -16, {
      treatment_state: "in_treatment",
      treatment: { ...open, mine: true },
    });
    update({
      closed_at: "2026-01-01T00:10:00Z",
      treatment_state: "treated",
      treatment: { ...open, status: "CLOSED", mine: false },
    });
    expect(screen.getByText("Inline form call_driver")).toBeInTheDocument();
    expect(setIsFormOpen).not.toHaveBeenCalled();
    update(
      {
        treatment_state: "treated",
        treatment: { ...open, status: "CLOSED", mine: false },
      },
      false
    );
    update({
      treatment_state: "treated",
      treatment: { ...open, status: "CLOSED", mine: false },
    });
    expect(screen.queryByText(/Inline form/)).toBeNull();
  });

  it("keeps the owner's existing form when the engine closes the case before the episode", () => {
    const { update } = renderPanel("call_driver", true, -16, {
      treatment_state: "in_treatment",
      treatment: { ...open, mine: true },
    });
    update({
      closed_at: "2026-01-01T00:10:00Z",
      treatment_state: "untreated",
      treatment: null,
    });
    expect(screen.getByText("Inline form call_driver")).toBeInTheDocument();
  });

  it("opens the form on the user's own open treatment after the engine closed the case", () => {
    const { setIsFormOpen } = renderPanel("call_driver", true, -16, {
      closed_at: "2026-01-01T00:10:00Z",
      treatment_state: "in_treatment",
      treatment: { ...open, mine: true },
    });

    expect(screen.getByText("Inline form call_driver")).toBeInTheDocument();
    expect(setIsFormOpen).not.toHaveBeenCalled();
  });

  it("shows an open treated case read-only", () => {
    renderPanel("call_driver", true, -16, {
      treatment_state: "treated",
      treatment: { ...open, status: "CLOSED", closed_by: "operator-a" },
    });
    expect(screen.queryByText(/Inline form/)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Caso tratado. Solo lectura."
    );
    expectNoActions();
  });

  it("keeps a held case read-only even for the operator who set the hold", () => {
    renderPanel("call_driver", true, -16, {
      treatment_state: "in_treatment",
      treatment: { ...open, mine: true },
      ignored: {
        treatment_id: open.id,
        since: "2026-01-01T00:05:00Z",
        until: null,
        until_trip_end: true,
        scope: "ALL",
        by: "operator-a",
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Caso ignorado.");
    expect(screen.queryByText(/Inline form/)).toBeNull();
    expectNoActions();
  });

  it("keeps the actions on the user's own open treatment", () => {
    renderPanel("call_driver", false, -16, {
      treatment_state: "in_treatment",
      treatment: { ...open, mine: true },
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: /Llamar/ })).toBeInTheDocument();
  });

  it("opens the form on the user's own open treatment", () => {
    renderPanel("call_driver", true, -16, {
      treatment_state: "in_treatment",
      treatment: { ...open, mine: true },
    });

    expect(screen.getByText("Inline form call_driver")).toBeInTheDocument();
  });

  it("shows a treated, closed case read-only with how it was handled", () => {
    renderPanel("call_driver", false, -16, {
      closed_at: "2026-01-01T00:10:00Z",
      treatment_state: "treated",
      treatment: {
        id: "t-2",
        status: "CLOSED",
        outcome: "invalidate",
        closed_by: "operator-b",
        closed_at: "2026-01-01T00:09:00Z",
      },
    });

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Caso tratado. Solo lectura.");
    expect(notice).toHaveTextContent("Invalidado");
    expect(notice).toHaveTextContent("por operator-b");
    expectNoActions();
  });

  it("shows a case that closed without a treatment read-only", () => {
    renderPanel("call_driver", false, -16, {
      closed_at: "2026-01-01T00:10:00Z",
      treatment_state: "untreated",
      treatment: null,
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Caso cerrado. Solo lectura."
    );
    expectNoActions();
  });

  it("keeps the actions on an open untreated case", () => {
    renderPanel("call_driver", false, -16, {
      treatment_state: "untreated",
      treatment: null,
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: /Llamar/ })).toBeInTheDocument();
  });
});

describe("the case panel's actions", () => {
  it("shows only 'Otras opciones' and 'Llamar' as buttons", () => {
    renderPanel("call_driver", false);

    expect(
      screen.getByRole("button", { name: /Otras opciones/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Llamar/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar gestión" })
    ).not.toBeInTheDocument();
  });

  it("offers 'Registrar gestión' in 'Otras opciones' on an engine case and opens its form", () => {
    const { setSelectedOption, setIsFormOpen } = renderPanel(
      "call_driver",
      false
    );

    openOtherOptions();
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));

    expect(setSelectedOption).toHaveBeenCalledWith("record_handling");
    expect(setIsFormOpen).toHaveBeenCalledWith(true);
  });

  it.each([42, 0, null])(
    "leaves 'Registrar gestión' out of 'Otras opciones' outside an engine case (%s)",
    (symptomId) => {
      renderPanel("call_driver", false, symptomId);

      openOtherOptions();

      expect(
        screen.getByRole("button", { name: "Ignorar condición" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Registrar gestión" })
      ).not.toBeInTheDocument();
    }
  );

  it("opens 'Registrar gestión' inline even with the past forms on", () => {
    config.pastForms = true;
    renderPanel("record_handling", true);

    expect(screen.getByText("Inline form record_handling")).toBeInTheDocument();
    expect(screen.queryByText("Past modal")).not.toBeInTheDocument();
    expect(screen.queryByText("Timeline")).not.toBeInTheDocument();
  });

  it("keeps the past modal for the forms it implements", () => {
    config.pastForms = true;
    renderPanel("ignore_condition", true);

    expect(screen.getByText("Past modal")).toBeInTheDocument();
    expect(screen.queryByText(/Inline form/)).not.toBeInTheDocument();
  });
});
