import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import TimedSymptoms from "./timed-symptoms";
import type { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";
import dict from "@/lang/es.json";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    "aria-label": label,
  }: {
    href: string;
    children: ReactNode;
    "aria-label"?: string;
  }) => (
    <a href={href} aria-label={label}>
      {children}
    </a>
  ),
}));
vi.mock("../condition-icon", () => ({ default: () => null }));
// The real one measures widths, which are zero in jsdom.
vi.mock("../tag-manager", () => ({
  default: ({ tags }: { tags: { text: ReactNode }[] }) => (
    <ul>
      {tags.map((tag, i) => (
        <li key={i}>{tag.text}</li>
      ))}
    </ul>
  ),
}));
vi.mock("../../hooks/use-treatments-general", () => ({
  useTreatmentsGeneral: () => ({
    treatmentData: { trip_info: { origin: "A", destination: "B" } },
    loading: false,
    error: null,
  }),
}));

const tripId = "00000000-0000-4000-8000-000000000001";
const item: SymptomsICUItemResponse = {
  id: -1,
  client: "",
  driver: "",
  trip_id: tripId,
  asset_id: "vehicle-demo",
  end_time: "",
  start_time: "2026-01-01T00:00:00Z",
  duration_sec: 60,
  symptom_name: "Demo symptom",
  icu_condition: "Critical Condition",
  icu_code: "3",
  treatment_count: 0,
  type_of_incidence: "Demo symptom",
  geographical_reference_point: "",
};

function renderItem(data: SymptomsICUItemResponse) {
  return render(<TimedSymptoms data={data} initial_state dict={dict} />);
}

describe("TimedSymptoms", () => {
  it("shows the trip's service code instead of its id", () => {
    renderItem({ ...item, trip_code: " SERVICE-001 " });

    expect(screen.getByText("ID: SERVICE-001")).toBeTruthy();
    expect(screen.queryByText(`ID: ${tripId}`)).toBeNull();
  });

  it.each([
    [undefined, undefined, "Ir al tratamiento"],
    ["untreated", null, "Ir al tratamiento"],
    ["in_treatment", { id: "t", status: "OPEN", mine: true }, "Continuar"],
    [
      "in_treatment",
      { id: "t", status: "OPEN", mine: false, opened_by: "operator-a" },
      "En tratamiento por operator-a",
    ],
    ["treated", { id: "t", status: "CLOSED" }, "Ver tratamiento"],
  ] as const)(
    "labels the row's action for state %s",
    (treatment_state, treatment, label) => {
      renderItem({ ...item, treatment_state, treatment });

      expect(screen.getByRole("link", { name: label })).toBeTruthy();
    }
  );

  it.each([undefined, null, "  "])(
    "falls back to the trip id when the code is %j",
    (code) => {
      renderItem({ ...item, trip_code: code });

      expect(screen.getByText(`ID: ${tripId}`)).toBeTruthy();
    }
  );
});
