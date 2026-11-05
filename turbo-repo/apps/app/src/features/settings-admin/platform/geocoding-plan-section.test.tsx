import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import GeocodingPlanSection from "./geocoding-plan-section";

const state = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(undefined),
  plan: {
    monthlyPriceUsd: 10,
    resolutionsPerMonth: 1000,
    overagePriceUsd: 0.005,
    alertPct: 80,
    enforced: true,
    updatedBy: null,
    updatedAt: null,
  },
}));
vi.mock("./use-geocoding-plan", () => ({
  useGeocodingPlan: () => ({
    plan: state.plan,
    isLoading: false,
    error: null,
    save: state.save,
  }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const dict = es.pages.userSettings.platform.geocodingPlan;

describe("geocoding plan on the shared plan form", () => {
  it("keeps its fields, bounds, notes and the link to the alert rules", () => {
    render(<GeocodingPlanSection dict={dict} />);
    expect(screen.getByLabelText(dict.alertPct)).toHaveAttribute("max", "100");
    expect(screen.getByLabelText(dict.overagePrice)).toHaveAttribute(
      "step",
      "0.0001"
    );
    expect(screen.getByText(dict.countHelp)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: dict.alertsLink })).toHaveAttribute(
      "href",
      "/es/users/settings/communications?section=rules"
    );
    expect(screen.getByText(dict.enforcedOn)).toBeInTheDocument();
  });

  it("refuses an alert over 100 and saves a valid plan", async () => {
    const user = userEvent.setup();
    render(<GeocodingPlanSection dict={dict} />);
    const alert = screen.getByLabelText(dict.alertPct);
    await user.clear(alert);
    await user.type(alert, "120");
    await user.click(screen.getByRole("button", { name: dict.save }));
    expect(screen.getByText(dict.errors.alertPct)).toBeInTheDocument();
    await user.clear(alert);
    await user.type(alert, "90");
    await user.click(screen.getByRole("button", { name: dict.save }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        monthlyPriceUsd: 10,
        resolutionsPerMonth: 1000,
        overagePriceUsd: 0.005,
        alertPct: 90,
        enforced: true,
      })
    );
  });
});
