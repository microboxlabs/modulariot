import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { OrgTelephonyUsage } from "@/features/telephony/telephony-plan";
import TelephonyTenantsSection from "./telephony-tenants-section";
import { NO_TELEPHONY_FILTERS } from "./telephony-tenants-view";

const state = vi.hoisted(() => ({
  usage: [] as OrgTelephonyUsage[],
  saveMinutes: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./use-telephony-plan", () => ({
  useTelephonyPlan: () => ({ plan: { minutesPerMonth: 300 } }),
  useTelephonyTenants: () => ({
    organizations: state.usage,
    isLoading: false,
    error: null,
    saveMinutes: state.saveMinutes,
  }),
}));
vi.mock("./use-platform-organizations", () => ({
  usePlatformOrganizations: () => ({
    organizations: [
      {
        slug: "new-org",
        name: "new-org",
        displayName: "New organization",
        tenantClientId: "c-new",
        taxId: null,
        parentSlug: null,
      },
      {
        slug: "acme",
        name: "acme",
        displayName: "Transportes Acme",
        tenantClientId: "c-acme",
        taxId: null,
        parentSlug: null,
      },
    ],
  }),
}));

const dict = es.pages.userSettings.platform.telephonyTenants;

function acmeUsage(): OrgTelephonyUsage {
  return {
    tenantCode: "acme",
    subscription: { monthlyMinutes: 500, updatedBy: null, updatedAt: null },
    usage: {
      periodStart: "2026-11-01T00:00:00Z",
      periodEnd: "2026-12-01T00:00:00Z",
      quotaMinutes: 500,
      usedMinutes: 450,
      pending: 2,
      chargeUsd: 12.5,
      providerCost: 4,
      lines: [
        {
          channel: "VOICE",
          destinationType: "CL_MOBILE",
          calls: 30,
          seconds: 26000,
          billedMinutes: 450,
          chargeUsd: 12,
          providerCost: 4,
        },
        {
          channel: "WHATSAPP_TEMPLATE",
          destinationType: "WHATSAPP_TEMPLATE",
          calls: 10,
          seconds: 0,
          billedMinutes: 0,
          chargeUsd: 0.5,
          providerCost: null,
        },
      ],
    },
  };
}

function renderSection(assigning = false) {
  return render(
    <TelephonyTenantsSection
      dict={dict}
      lang="es"
      filters={NO_TELEPHONY_FILTERS}
      sort="USAGE_DESC"
      month="2026-11"
      assigning={assigning}
      onAssignDone={() => {}}
    />
  );
}

beforeEach(() => {
  state.usage = [];
  state.saveMinutes.mockClear();
});

describe("telephony organizations", () => {
  it("says no organization has minutes or usage, like geocoding's empty table", () => {
    renderSection();
    expect(screen.getByText(dict.empty)).toBeInTheDocument();
  });

  it("names the organization and shows minutes against its quota, calls and pending", () => {
    state.usage = [acmeUsage()];
    renderSection();
    const row = screen.getByText("Transportes Acme").closest("tr")!;
    expect(within(row).getByText("450 / 500")).toBeInTheDocument();
    expect(within(row).getByText("30")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(row.querySelector("[data-level]")?.getAttribute("data-level")).toBe(
      "alert"
    );
  });

  it("assigns minutes from the header button to an organization without usage", async () => {
    const user = userEvent.setup();
    renderSection(true);
    await user.click(
      screen.getByPlaceholderText(dict.modal.searchOrganization)
    );
    await user.click(
      await screen.findByRole("option", { name: /New organization/ })
    );
    // Headless UI restores focus to its input on the next animation frame.
    await act(async () => {
      await new Promise<number>(requestAnimationFrame);
    });
    await user.type(screen.getByLabelText(dict.modal.quota), "120");
    await user.click(screen.getByRole("button", { name: dict.save }));
    await waitFor(() =>
      expect(state.saveMinutes).toHaveBeenCalledWith("c-new", 120)
    );
  });

  it("blocks assigning an organization whose tenant already has its own minutes", async () => {
    state.usage = [{ ...acmeUsage(), tenantCode: "c-acme" }];
    const user = userEvent.setup();
    renderSection(true);
    await user.click(
      screen.getByPlaceholderText(dict.modal.searchOrganization)
    );
    expect(
      await screen.findByRole("option", { name: /Transportes Acme/ })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("preserves the tenant code when editing an existing quota", async () => {
    state.usage = [{ ...acmeUsage(), tenantCode: "c-acme" }];
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("button", { name: dict.edit }));
    await user.click(screen.getByRole("button", { name: dict.save }));
    await waitFor(() =>
      expect(state.saveMinutes).toHaveBeenCalledWith("c-acme", 500)
    );
  });

  it("edits a row's minutes; empty goes back to the plan's", async () => {
    state.usage = [acmeUsage()];
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("button", { name: dict.edit }));
    const input = screen.getByLabelText(dict.modal.quota);
    expect(input).toHaveValue(500);
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: dict.save }));
    await waitFor(() =>
      expect(state.saveMinutes).toHaveBeenCalledWith("acme", null)
    );
  });
});
