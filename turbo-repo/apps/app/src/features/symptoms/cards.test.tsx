import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import SymptomsCards from "./cards";

let searchParams = new URLSearchParams();
const useCounts = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push }),
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
  push.mockReset();
  globalThis.history.replaceState(null, "", "/");
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

  it.each(["required", "none", "all"])(
    "uses the %s operator scope for the cards",
    (operator) => {
      searchParams = new URLSearchParams({ operator });
      render(<SymptomsCards showCards dict={dict} />);
      expect(useCounts).toHaveBeenCalledWith(
        expect.objectContaining({ operator }),
        true
      );
    }
  );

  it("filters the list to the cases in treatment when its card is clicked", () => {
    globalThis.history.replaceState(null, "", "/?asset_id=demo-asset");
    render(<SymptomsCards showCards dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: /Treatment/ }));

    expect(push).toHaveBeenCalledWith("?asset_id=demo-asset&icu_code=6");
  });

  it("counts the cards in the list's treatment state", () => {
    searchParams = new URLSearchParams({ treatment: "in_treatment" });
    render(<SymptomsCards showCards dict={dict} />);

    expect(useCounts).toHaveBeenCalledWith(
      expect.objectContaining({ treatment: "in_treatment" }),
      true
    );
  });

  it("disables its counts request while the tray is collapsed", () => {
    render(<SymptomsCards showCards={false} dict={dict} />);

    expect(useCounts.mock.calls[0][1]).toBe(false);
  });
});
