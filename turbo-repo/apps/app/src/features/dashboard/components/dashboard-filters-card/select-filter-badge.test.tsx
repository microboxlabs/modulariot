import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SelectFilterBadge } from "./select-filter-badge";
import type { DashboardFilterParam } from "../../types/dashboard.types";

vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key.split(".").pop() ?? key,
}));

vi.mock("../../hooks/use-filter-options", () => ({
  useFilterOptions: (filter: DashboardFilterParam) => ({
    options: filter.options ?? [],
    loading: false,
    error: null,
    dynamic: false,
  }),
}));

const OPTIONS = [
  { value: "Lost Signal", label: "Perdida de señal" },
  { value: "Speed Limit", label: "Exceso de velocidad" },
];

function renderBadge(overrides: Partial<DashboardFilterParam>, values: string[] = []) {
  const onApply = vi.fn();
  const onClear = vi.fn();
  const filter: DashboardFilterParam = {
    key: "symptom_name",
    label: "Nombre del síntoma",
    type: "select",
    options: OPTIONS,
    ...overrides,
  };
  render(
    <SelectFilterBadge
      filter={filter}
      values={values}
      onApply={onApply}
      onClear={onClear}
      dictionary={{}}
    />
  );
  // The trigger renders the label with a trailing ":" once a value is set.
  fireEvent.click(screen.getByText(/^Nombre del síntoma:?$/));
  return { onApply, onClear };
}

/**
 * Click an option inside the dropdown. The selected value is also echoed on the
 * trigger, so target the last match — the panel is portaled after the badge.
 */
function pickOption(label: string) {
  const matches = screen.getAllByText(label);
  fireEvent.mouseDown(matches[matches.length - 1]);
}

afterEach(cleanup);

describe("SelectFilterBadge", () => {
  it("accumulates values by default", () => {
    const { onApply } = renderBadge({}, ["Lost Signal"]);

    pickOption("Exceso de velocidad");

    expect(onApply).toHaveBeenCalledWith(["Lost Signal", "Speed Limit"]);
  });

  it("replaces the value when the filter is single-valued", () => {
    const { onApply } = renderBadge({ single: true }, ["Lost Signal"]);

    pickOption("Exceso de velocidad");

    // Not ["Lost Signal", "Speed Limit"] — that would reach the API as one
    // comma-joined string and match nothing.
    expect(onApply).toHaveBeenCalledWith(["Speed Limit"]);
  });

  it("clears when the selected value is picked again in single mode", () => {
    const { onApply, onClear } = renderBadge({ single: true }, ["Lost Signal"]);

    pickOption("Perdida de señal");

    expect(onClear).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("closes the dropdown after a single-mode pick", () => {
    renderBadge({ single: true });

    pickOption("Perdida de señal");

    expect(screen.queryByText("Exceso de velocidad")).toBeNull();
  });

  it("keeps the dropdown open in multi mode", () => {
    renderBadge({});

    pickOption("Perdida de señal");

    expect(screen.queryByText("Exceso de velocidad")).not.toBeNull();
  });
});
