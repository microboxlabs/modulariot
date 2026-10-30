import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import GeocodingUsage from "./geocoding-usage";
import type { OrgGeocodingPlan } from "./geocoding-plan.types";

const state = vi.hoisted(() => ({ data: null as OrgGeocodingPlan | null }));
vi.mock("./use-org-geocoding-plan", () => ({
  useOrgGeocodingPlan: () => ({
    data: state.data,
    isLoading: false,
    error: null,
  }),
}));
beforeEach(() => {
  state.data = {
    plan: {
      monthlyPriceUsd: 123,
      resolutionsPerMonth: 9876,
      overagePriceUsd: 0.5,
      alertPct: 80,
      enforced: true,
      updatedBy: null,
      updatedAt: null,
    },
    subscription: null,
    usage: {
      periodStart: "2026-10-01T00:00:00Z",
      periodEnd: "2026-11-01T00:00:00Z",
      quota: null,
      used: 0,
      resolutions: 0,
      cacheHits: 0,
      overageCalls: 0,
      overageUsd: null,
      chargeUsd: null,
      bySource: [],
    },
    enforced: true,
  };
});
describe("geocoding without a subscription", () => {
  it.each([true, false])(
    "does not promise a quota or overage pricing when enforcement is %s",
    (enforced) => {
      state.data!.enforced = enforced;
      render(
        <GeocodingUsage
          orgSlug="synthetic-org"
          lang="en"
          d={en.pages.userSettings.geocoding.usage}
        />
      );
      expect(
        screen.getByText(/No subscription is recorded for this period/)
      ).toBeInTheDocument();
      expect(screen.queryByText(/9,876/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$0\.50/)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/each extra call costs/i)
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          enforced
            ? /Provider calls require an assigned subscription/
            : /no plan charge is calculated/
        )
      ).toBeInTheDocument();
    }
  );
});
