import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DynamicFieldConfig } from "@/features/dynamic-forms";

const { useLiveETA } = vi.hoisted(() => ({ useLiveETA: vi.fn() }));

vi.mock(
  "@/features/common/providers/client-api.provider",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/features/common/providers/client-api.provider")
    >()),
    useLiveETA,
  })
);

import { LiveFormField } from "./live-form-field";

const field: DynamicFieldConfig = {
  name: "eta",
  labelKey: "eta",
  type: "live",
  liveField: { dataKey: "eta", displayFormat: "datetime" },
};
const dict = { duration: "Duración", distance: "Distancia" };

function renderWithEta(duration: number, distance: number) {
  useLiveETA.mockReturnValue({
    eta: { estimatedArrival: "2026-11-12T10:00:00Z", duration, distance },
    isLoading: false,
    error: null,
  });
  return render(
    <LiveFormField field={field} allValues={{}} isVisible dict={dict} />
  );
}

describe("LiveFormField ETA details", () => {
  it("renders nothing when duration and distance are 0", () => {
    const { container } = renderWithEta(0, 0);

    expect(container.textContent).toBe("");
  });

  it("shows the duration and distance badges when they are set", () => {
    const { container } = renderWithEta(90, 12.5);

    expect(container.textContent).toContain("Duración: 1h 30m");
    expect(container.textContent).toContain("Distancia: 12.50 km");
  });
});
