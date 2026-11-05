import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { OrgGeocodingUsage } from "@/features/geocoding/geocoding-plan.types";
import GeocodingTenantsSection from "./geocoding-tenants-section";
import { NO_TENANT_FILTERS } from "./geocoding-tenants-view";

const state = vi.hoisted(() => ({
  saveSubscription: vi.fn().mockResolvedValue(undefined),
  usage: [] as OrgGeocodingUsage[],
}));
vi.mock("./use-geocoding-plan", () => ({
  useGeocodingPlan: () => ({
    plan: {
      monthlyPriceUsd: 0,
      resolutionsPerMonth: 1000,
      overagePriceUsd: 0.005,
      alertPct: 80,
      enforced: true,
      updatedBy: null,
      updatedAt: null,
    },
  }),
  useGeocodingSubscriptions: () => ({
    organizations: state.usage,
    isLoading: false,
    error: null,
    saveSubscription: state.saveSubscription,
  }),
}));
vi.mock("./use-platform-organizations", () => ({
  usePlatformOrganizations: () => ({ organizations: [] }),
}));

const dict = es.pages.userSettings.platform.geocodingTenants;

function geoUsage(subscribed: boolean): OrgGeocodingUsage {
  return {
    organization: "acme",
    subscription: subscribed
      ? {
          monthlyQuota: 2000,
          onExhausted: "review",
          updatedBy: null,
          updatedAt: null,
        }
      : null,
    usage: {
      periodStart: "2026-11-01T00:00:00Z",
      periodEnd: "2026-12-01T00:00:00Z",
      quota: subscribed ? 2000 : null,
      used: 100,
      resolutions: 200,
      cacheHits: 50,
      overageCalls: 0,
      overageUsd: null,
      chargeUsd: null,
      bySource: [],
      providerCostUsd: 0.5,
    },
  };
}

function renderSection() {
  render(
    <GeocodingTenantsSection
      dict={dict}
      lang="es"
      filters={NO_TENANT_FILTERS}
      sort="USAGE_DESC"
      month="2026-11"
      assigning={false}
      onAssignDone={() => {}}
    />
  );
}

describe("geocoding organizations on the shared table", () => {
  it("badges an organization without a subscription instead of a bar", () => {
    state.usage = [geoUsage(false)];
    renderSection();
    const row = screen
      .getByText("acme", { selector: "div.font-medium" })
      .closest("tr")!;
    expect(within(row).getByText(dict.noSubscription)).toBeInTheDocument();
    expect(row.querySelector("[data-level]")).toBeNull();
    expect(within(row).getByText("25%")).toBeInTheDocument();
  });

  it("edits the quota and the mode in the 3xl modal", async () => {
    state.usage = [geoUsage(true)];
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("button", { name: dict.edit }));
    expect(screen.getByLabelText(dict.modal.quota)).toHaveValue(2000);
    await user.click(
      screen.getByRole("radio", { name: new RegExp(dict.modes.overage.label) })
    );
    await user.click(screen.getByRole("button", { name: dict.save }));
    await waitFor(() =>
      expect(state.saveSubscription).toHaveBeenCalledWith("acme", {
        monthlyQuota: 2000,
        onExhausted: "overage",
      })
    );
  });
});
