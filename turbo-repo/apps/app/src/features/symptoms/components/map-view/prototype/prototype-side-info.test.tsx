import type { PropsWithChildren } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
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
vi.mock("../blurrable-dropdown", () => ({ default: () => null }));
vi.mock("../../blurrable-stepped-menu/symptom-form", () => ({
  default: () => <p>Past modal</p>,
}));
vi.mock("./prototype-inline-form", () => ({
  default: ({ selectedOption }: { selectedOption: string }) => (
    <p>Inline form {selectedOption}</p>
  ),
}));

function renderPanel(selectedOption: SelectedOption, isFormOpen: boolean) {
  const setSelectedOption = vi.fn();
  const setIsFormOpen = vi.fn();
  render(
    <PrototypeSideInfo
      dict={es as I18nRecord}
      treatmentData={null}
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
  return { setSelectedOption, setIsFormOpen };
}

beforeEach(() => {
  config.pastForms = false;
});

describe("the case panel's actions", () => {
  it("offers 'Registrar gestión' next to 'Llamar' and opens its form", () => {
    const { setSelectedOption, setIsFormOpen } = renderPanel(
      "call_driver",
      false
    );

    expect(screen.getByRole("button", { name: /Llamar/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));

    expect(setSelectedOption).toHaveBeenCalledWith("record_handling");
    expect(setIsFormOpen).toHaveBeenCalledWith(true);
  });

  it("opens 'Registrar gestión' inline even with the past forms on", () => {
    config.pastForms = true;
    renderPanel("record_handling", true);

    expect(
      screen.getByText("Inline form record_handling")
    ).toBeInTheDocument();
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
