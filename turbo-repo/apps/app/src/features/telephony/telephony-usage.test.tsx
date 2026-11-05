import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import { monthOf } from "@/features/metered-usage/usage-view";
import type { OrgTelephonyPlan } from "./telephony-plan";
import TelephonyUsage, { chargeSplit } from "./telephony-usage";

const state = vi.hoisted(() => ({
  data: null as OrgTelephonyPlan | null,
  error: null as { status: number } | null,
}));
vi.mock("./use-org-telephony-usage", () => ({
  useOrgTelephonyUsage: () => ({
    data: state.data,
    isLoading: false,
    error: state.error,
  }),
}));

const d = es.pages.userSettings.telephony.usage;
const thisMonth = monthOf(new Date());

beforeEach(() => {
  state.error = null;
  state.data = {
    plan: {
      minutesPerMonth: 100,
      clMobileUsd: 0.05,
      clLandlineUsd: 0.03,
      otherUsd: 0.2,
      whatsappCallUsd: 0.01,
      whatsappTemplateUsd: 0.02,
      enforced: true,
      updatedBy: null,
      updatedAt: null,
    },
    subscription: null,
    usage: {
      periodStart: `${thisMonth}-01T00:00:00Z`,
      periodEnd: `${thisMonth}-28T00:00:00Z`,
      quotaMinutes: 100,
      usedMinutes: 100,
      pending: 3,
      chargeUsd: 5.2,
      providerCost: null,
      lines: [
        {
          channel: "WHATSAPP_TEMPLATE",
          destinationType: "WHATSAPP_TEMPLATE",
          calls: 10,
          seconds: 0,
          billedMinutes: 0,
          chargeUsd: 0.2,
          providerCost: null,
        },
        {
          channel: "VOICE",
          destinationType: "CL_MOBILE",
          calls: 20,
          seconds: 5800,
          billedMinutes: 100,
          chargeUsd: 5,
          providerCost: null,
        },
      ],
    },
  };
});

describe("telephony month's usage", () => {
  it("shows minutes against the plan's quota, calls, charge and destinations", () => {
    render(<TelephonyUsage orgSlug="org" lang="es" d={d} />);
    expect(screen.getByText("/ 100 minutos")).toBeInTheDocument();
    expect(screen.getByText(/minutos del plan/)).toBeInTheDocument();
    expect(screen.getAllByText("20")).toHaveLength(2);
    expect(screen.getByText("3 sin confirmar por Telnyx")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").map((r) => r.textContent);
    expect(rows[1]).toContain("Móvil Chile");
    expect(rows[2]).toContain("Plantilla WhatsApp");
  });

  it("warns when the minutes are used up this month under an applied plan", () => {
    render(<TelephonyUsage orgSlug="org" lang="es" d={d} />);
    expect(screen.getByText(d.quotaExhausted)).toBeInTheDocument();
    expect(screen.queryByText(d.notEnforced)).not.toBeInTheDocument();
  });

  it("says the minutes are not applied when the plan is off", () => {
    state.data!.plan.enforced = false;
    render(<TelephonyUsage orgSlug="org" lang="es" d={d} />);
    expect(screen.getByText(d.notEnforced)).toBeInTheDocument();
    expect(screen.queryByText(d.quotaExhausted)).not.toBeInTheDocument();
  });

  it("tells a non-owner they cannot see it", () => {
    state.data = null;
    state.error = { status: 403 };
    render(<TelephonyUsage orgSlug="org" lang="es" d={d} />);
    expect(screen.getByText(d.forbidden)).toBeInTheDocument();
  });

  it("splits the charge into calls and templates", () => {
    expect(chargeSplit(state.data!.usage.lines)).toEqual({
      calls: 5,
      templates: 0.2,
    });
  });

  it("says Microsoft bills the organization's Teams Phone calls", () => {
    render(
      <TelephonyUsage orgSlug="org" lang="es" d={d} ownLine="TEAMS_PHONE" />
    );
    expect(screen.getByText(d.ownTeams)).toBeInTheDocument();
    expect(screen.queryByText(d.ownTelnyx)).not.toBeInTheDocument();
  });

  it("has no own-line notice on the platform line", () => {
    render(<TelephonyUsage orgSlug="org" lang="es" d={d} />);
    expect(screen.queryByText(d.ownTeams)).not.toBeInTheDocument();
    expect(screen.queryByText(d.ownTelnyx)).not.toBeInTheDocument();
  });
});
