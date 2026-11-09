import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import type { TelephonySetup } from "@/features/symptoms/control-tower/telephony-api";
import es from "@/lang/es.json";
import { OrgTelephonyChoice, OrgTelephonyUsage } from "./org-telephony-choice";

const platform = {
  connectionId: "p1",
  provider: "TELNYX" as const,
  name: "Plataforma",
  callerNumber: "+56900000000",
  ready: true,
  managed: true,
};
const teams = {
  connectionId: "m1",
  provider: "TEAMS_PHONE" as const,
  name: "Mintral Teams",
  callerNumber: null,
  ready: true,
};

const mocks = vi.hoisted(() => ({
  swr: {
    data: undefined as TelephonySetup | undefined,
    error: undefined as Error | undefined,
    isLoading: false,
  },
  saveTelephony: vi.fn(),
  month: {
    data: {
      plan: {
        minutesPerMonth: 300,
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
        periodStart: "2026-11-01T00:00:00Z",
        periodEnd: "2026-12-01T00:00:00Z",
        quotaMinutes: 300,
        usedMinutes: 12,
        pending: 1,
        chargeUsd: 0.6,
        providerCost: null,
        lines: [
          {
            channel: "VOICE",
            destinationType: "CL_MOBILE",
            calls: 4,
            seconds: 700,
            billedMinutes: 12,
            chargeUsd: 0.6,
            providerCost: null,
          },
        ],
      },
    },
    isLoading: false,
    error: null as { status: number } | null,
  },
}));
vi.mock("@/features/symptoms/control-tower/telephony-api", () => ({
  useTelephony: () => mocks.swr,
  saveTelephony: mocks.saveTelephony,
}));
vi.mock("@/features/telephony/use-org-telephony-usage", () => ({
  useOrgTelephonyUsage: () => mocks.month,
}));

const t = es.pages.userSettings.telephony.choice;
const u = es.pages.userSettings.telephony.usage;
const d = t as unknown as I18nRecord;
const renderChoice = () => render(<OrgTelephonyChoice dict={d} />);
const renderUsage = () =>
  render(
    <OrgTelephonyUsage
      dict={u as unknown as I18nRecord}
      orgSlug="mintral"
      lang="es"
    />
  );
const select = () =>
  screen.getByLabelText(t.title) as unknown as HTMLSelectElement;

function setup(s: Partial<TelephonySetup>) {
  mocks.swr.data = {
    preferred: null,
    active: platform,
    lines: [platform, teams],
    ...s,
  };
  mocks.swr.error = undefined;
}

describe("OrgTelephonyChoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveTelephony.mockResolvedValue(undefined);
  });

  it("without a settings row shows no choice yet and saves the first one", async () => {
    setup({ preferred: null });
    renderChoice();
    expect(select().value).toBe("");
    expect(select()).toHaveAccessibleDescription(t.hint);
    expect(screen.getByText(t.unsetHint)).toBeInTheDocument();
    expect(
      screen.getByText(t.inUse.replace("{line}", t.platform))
    ).toBeInTheDocument();
    fireEvent.change(select(), { target: { value: "TEAMS_PHONE" } });
    await waitFor(() =>
      expect(mocks.saveTelephony).toHaveBeenCalledWith("TEAMS_PHONE")
    );
  });

  it("with Telnyx chosen lists the platform line and the Teams Phone provider", () => {
    setup({ preferred: "TELNYX" });
    renderChoice();
    expect(select().value).toBe("TELNYX");
    const options = Array.from(select().options).map((o) => o.textContent);
    expect(options).toEqual([
      t.platform,
      t.teams.replace("{name}", "Mintral Teams"),
    ]);
    expect(screen.queryByText(t.unsetHint)).toBeNull();
    expect(screen.queryByText(u.title)).toBeNull();
  });

  it("offers one Teams choice matching the backend's first ready connection", async () => {
    setup({
      preferred: "TELNYX",
      lines: [
        platform,
        { ...teams, connectionId: "untested", name: "Untested", ready: false },
        teams,
        { ...teams, connectionId: "m2", name: "Second Teams" },
      ],
    });
    renderChoice();
    const options = Array.from(select().options).filter(
      (option) => option.value === "TEAMS_PHONE"
    );
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(t.teams.replace("{name}", teams.name));
    expect(options[0]).not.toBeDisabled();
    fireEvent.change(select(), { target: { value: "TEAMS_PHONE" } });
    await waitFor(() =>
      expect(mocks.saveTelephony).toHaveBeenCalledWith("TEAMS_PHONE")
    );
  });

  it("with Teams Phone chosen shows it in use and can go back to Telnyx", async () => {
    setup({ preferred: "TEAMS_PHONE", active: teams });
    renderChoice();
    expect(select().value).toBe("TEAMS_PHONE");
    expect(
      screen.getByText(
        t.inUse.replace("{line}", t.teams.replace("{name}", "Mintral Teams"))
      )
    ).toBeInTheDocument();
    fireEvent.change(select(), { target: { value: "TELNYX" } });
    await waitFor(() =>
      expect(mocks.saveTelephony).toHaveBeenCalledWith("TELNYX")
    );
  });

  it("disables an untested Teams Phone connection and says why", () => {
    setup({
      preferred: "TELNYX",
      lines: [platform, { ...teams, ready: false }],
    });
    renderChoice();
    const option = Array.from(select().options).find(
      (o) => o.value === "TEAMS_PHONE"
    );
    expect(option?.disabled).toBe(true);
    expect(
      screen.getByText(t.notReady.replace("{name}", "Mintral Teams"))
    ).toBeInTheDocument();
  });

  it("keeps a saved Teams choice visible after its connection is removed", async () => {
    setup({ preferred: "TEAMS_PHONE", active: platform, lines: [platform] });
    renderChoice();
    expect(select()).toHaveValue("TEAMS_PHONE");
    expect(screen.getByText(t.noTeamsHint)).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: t.teamsUnavailable })
    ).toBeDisabled();
    expect(
      screen.getByText(t.inUse.replace("{line}", t.platform))
    ).toBeInTheDocument();
    fireEvent.change(select(), { target: { value: "TELNYX" } });
    await waitFor(() =>
      expect(mocks.saveTelephony).toHaveBeenCalledWith("TELNYX")
    );
  });

  it("says who may change it when the API refuses", async () => {
    setup({ preferred: "TELNYX" });
    mocks.saveTelephony.mockRejectedValueOnce(
      new ControlTowerError("forbidden", 403)
    );
    renderChoice();
    fireEvent.change(select(), { target: { value: "TEAMS_PHONE" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(t.forbidden);
    expect(select()).not.toBeDisabled();
  });

  it("says so without telephony lines or when the API fails", () => {
    setup({ lines: [], active: null });
    const { rerender } = renderChoice();
    expect(screen.getByRole("status")).toHaveTextContent(t.noLines);
    expect(screen.queryByLabelText(t.title)).toBeNull();
    setup({});
    mocks.swr.error = new Error("Synthetic load failure");
    rerender(<OrgTelephonyChoice dict={d} />);
    expect(screen.getByRole("alert")).toHaveTextContent(t.loadFailed);
  });
});

describe("OrgTelephonyUsage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("on the platform line shows minutes against the quota, the bar and the charge", () => {
    setup({ preferred: "TELNYX" });
    const { container } = renderUsage();
    expect(screen.getByText(u.title)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.title)).toBeNull();
    expect(screen.getByText("/ 300 minutos")).toBeInTheDocument();
    expect(
      container.querySelector("[data-level]")?.getAttribute("data-level")
    ).toBe("ok");
    expect(screen.getByText(/Total del mes: .*0,60/)).toBeInTheDocument();
    expect(screen.queryByText(u.ownTeams)).toBeNull();
  });

  it("explains that own-line setup is unknown while loading or after a failure", () => {
    setup({});
    mocks.swr.data = undefined;
    mocks.swr.isLoading = true;
    const { rerender } = renderUsage();
    expect(screen.getByText(u.setupUnavailable)).toBeInTheDocument();
    mocks.swr.isLoading = false;
    mocks.swr.error = new Error("Synthetic setup failure");
    rerender(
      <OrgTelephonyUsage
        dict={u as unknown as I18nRecord}
        orgSlug="mintral"
        lang="es"
      />
    );
    expect(screen.getByText(u.setupUnavailable)).toBeInTheDocument();
    expect(screen.getByText("/ 300 minutos")).toBeInTheDocument();
    setup({ preferred: "TEAMS_PHONE", active: teams });
    rerender(
      <OrgTelephonyUsage
        dict={u as unknown as I18nRecord}
        orgSlug="mintral"
        lang="es"
      />
    );
    expect(screen.queryByText(u.setupUnavailable)).toBeNull();
    expect(screen.getByText(u.ownTeams)).toBeInTheDocument();
  });

  it("with the organization's Teams Phone says Microsoft bills those calls and shows only platform minutes", () => {
    setup({ preferred: "TEAMS_PHONE", active: teams });
    renderUsage();
    expect(screen.getByText(u.ownTeams)).toBeInTheDocument();
    expect(screen.getByText("/ 300 minutos")).toBeInTheDocument();
  });

  it("with the organization's own Telnyx account says Telnyx bills those calls", () => {
    const own = {
      ...platform,
      connectionId: "o1",
      name: "Propia",
      managed: false,
    };
    setup({ preferred: "TELNYX", active: own, lines: [own] });
    renderUsage();
    expect(screen.getByText(u.ownTelnyx)).toBeInTheDocument();
  });

  it("shows geocoding's forbidden state to someone who is not an owner", () => {
    setup({ preferred: "TELNYX" });
    const data = mocks.month.data;
    Object.assign(mocks.month, { data: null, error: { status: 403 } });
    renderUsage();
    expect(screen.getByText(u.forbidden)).toBeInTheDocument();
    Object.assign(mocks.month, { data, error: null });
  });
});
