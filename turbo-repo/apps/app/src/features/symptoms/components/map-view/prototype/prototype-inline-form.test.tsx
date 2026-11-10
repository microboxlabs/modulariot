import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { SelectedOption } from "@/features/symptoms/types/side-info";
import es from "@/lang/es.json";
import PrototypeInlineForm from "./prototype-inline-form";

const flow = vi.hoisted(() => ({
  onSkip: vi.fn<(step: number) => void>(),
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("./prototype-record-handling", () => ({
  default: () => <p>Handling form</p>,
}));
vi.mock("./prototype-ignore-condition", () => ({ default: () => null }));
vi.mock("./prototype-invalidate-symptom", () => ({ default: () => null }));
vi.mock(
  "../../blurrable-stepped-menu/menus/whatsapp-contact/whatsapp-contact",
  () => ({ default: () => null })
);
vi.mock("./call-center/prototype-call-center-flow", () => ({
  default: ({
    skippedTo,
    onSkip,
  }: Readonly<{
    skippedTo: number | null;
    onSkip: (step: number) => void;
  }>) => {
    flow.onSkip.mockImplementation(onSkip);
    return (
      <>
        <output aria-label="Skipped step">{skippedTo ?? "none"}</output>
        <button onClick={() => onSkip(1)}>Skip</button>
      </>
    );
  },
}));

function panel(
  id: number,
  level: number,
  since: string,
  selectedOption: SelectedOption = "call_driver"
) {
  const treatmentData = {
    symptom_info: { id, icu_code: level, sla_since: since },
    trip_info: {},
  } as TreatmentsGeneralResponseItem;
  return (
    <PrototypeInlineForm
      setIsMenuOpen={vi.fn()}
      isMenuOpen={true}
      dict={es as I18nRecord}
      selectedOption={selectedOption}
      setSelectedOption={vi.fn()}
      treatmentData={treatmentData}
      treatments_templates={null}
    />
  );
}

describe("opening the engine-only handling form", () => {
  it.each([-7, 7])("shows the handling form for case %s", (id) => {
    render(panel(id, 3, "2026-11-05T12:00:00Z", "record_handling"));

    expect(screen.getByText("Handling form")).toBeInTheDocument();
  });
});

describe("local call-step progress", () => {
  it.each([
    [-7, 4, "2026-11-05T12:01:00Z", "a new level"],
    [-7, 3, "2026-11-05T12:01:00Z", "a resumed hold"],
    [-8, 3, "2026-11-05T12:00:00Z", "another case"],
  ])(
    "resets on %s/%s/%s (%s), including a late save response",
    (id, level, since) => {
      const view = render(panel(-7, 3, "2026-11-05T12:00:00Z"));
      fireEvent.click(screen.getByRole("button", { name: "Skip" }));
      expect(screen.getByLabelText("Skipped step")).toHaveTextContent("1");
      const oldSave = flow.onSkip.getMockImplementation()!;
      view.rerender(panel(id, level, since));
      expect(screen.getByLabelText("Skipped step")).toHaveTextContent("none");
      act(() => oldSave(2));
      expect(screen.getByLabelText("Skipped step")).toHaveTextContent("none");
    }
  );
});
