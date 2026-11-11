import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import SymptomsCards from "./cards";

let searchParams = new URLSearchParams();
const useCounts = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useSymptomCounts: (...args: unknown[]) => useCounts(...args),
  useSymptomsTable: vi.fn(),
}));

const dict: I18nRecord = {
  symptoms: {
    symptoms: "Síntomas",
    critical_condition: "Critical",
    in_treatment: "Treatment",
    ignored: "Ignored",
  },
};

beforeEach(() => {
  searchParams = new URLSearchParams();
  useCounts.mockReset();
  useCounts.mockReturnValue({
    counts: {
      conditions: { codeBlack: 0, critic: 3, treatment: 2 },
      ignored: 5,
    },
    loading: false,
    error: null,
  });
});

afterEach(cleanup);

describe("SymptomsCards", () => {
  it("renders the tray header without the settings cog", () => {
    render(<SymptomsCards showCards dict={dict} />);

    const heading = screen.getByRole("heading", { level: 1, name: "Síntomas" });
    const headerRow = heading.parentElement as HTMLElement;

    expect(within(headerRow).queryByRole("button")).not.toBeInTheDocument();
    expect(headerRow.querySelector("svg")).toBeNull();
  });

  it("uses the constellation counts with all list filters, including history dates", () => {
    searchParams = new URLSearchParams({
      asset_id: "demo-asset",
      symptom_name: "demo-symptom",
      carrier_id: "demo-carrier",
      date_from: "2026-10-01",
      date_to: "2026-10-02",
      icu_code: "4",
    });

    render(<SymptomsCards showCards dict={dict} />);

    expect(useCounts).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "demo-asset",
        symptom_name: "demo-symptom",
        carrier_id: "demo-carrier",
        date_range: { from: "2026-10-01", to: "2026-10-02" },
      }),
      true
    );
    expect(
      within(screen.getByRole("button", { name: /Critical/ })).getByText("03")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /Treatment/ })).getByText("02")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /Ignored/ })).getByText("05")
    ).toBeInTheDocument();
  });

  it("disables its counts request while the tray is collapsed", () => {
    render(<SymptomsCards showCards={false} dict={dict} />);

    expect(useCounts.mock.calls[0][1]).toBe(false);
  });
});
