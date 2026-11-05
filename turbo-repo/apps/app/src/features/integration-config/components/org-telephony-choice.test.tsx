import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import type { TelephonySetup } from "@/features/symptoms/control-tower/telephony-api";
import es from "@/lang/es.json";
import { OrgTelephonyChoice } from "./org-telephony-choice";

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
  },
  saveTelephony: vi.fn(),
  month: {
    data: {
      usage: { usedMinutes: 12, quotaMinutes: 300, pending: 1, chargeUsd: 0.6 },
    },
    error: null,
  },
}));
vi.mock("@/features/symptoms/control-tower/telephony-api", () => ({
  useTelephony: () => mocks.swr,
  saveTelephony: mocks.saveTelephony,
}));
vi.mock("@/features/telephony/use-org-telephony-usage", () => ({
  useOrgTelephonyUsage: () => mocks.month,
}));

const t = es.pages.integrationConnections.telephonyChoice;
const d = es.pages.integrationConnections as unknown as I18nRecord;
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
    render(<OrgTelephonyChoice dict={d} orgSlug="mintral" />);
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

  it("with Telnyx chosen lists the platform line and each Teams Phone connection", () => {
    setup({ preferred: "TELNYX" });
    render(<OrgTelephonyChoice dict={d} orgSlug="mintral" />);
    expect(select().value).toBe("TELNYX");
    const options = Array.from(select().options).map((o) => o.textContent);
    expect(options).toEqual([
      t.platform,
      t.teams.replace("{name}", "Mintral Teams"),
    ]);
    expect(screen.queryByText(t.unsetHint)).toBeNull();
    expect(screen.getByText(/12 de 300 minutos/)).toBeInTheDocument();
  });

  it("with Teams Phone chosen shows it in use and can go back to Telnyx", async () => {
    setup({ preferred: "TEAMS_PHONE", active: teams });
    render(<OrgTelephonyChoice dict={d} orgSlug="mintral" />);
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
    render(<OrgTelephonyChoice dict={d} orgSlug="mintral" />);
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
    render(<OrgTelephonyChoice dict={d} orgSlug="mintral" />);
    expect(select()).toHaveValue("TEAMS_PHONE");
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
    render(<OrgTelephonyChoice dict={d} orgSlug="mintral" />);
    fireEvent.change(select(), { target: { value: "TEAMS_PHONE" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(t.forbidden);
    expect(select()).not.toBeDisabled();
  });

  it("renders nothing without telephony lines or when the API fails", () => {
    setup({ lines: [], active: null });
    const { container, rerender } = render(
      <OrgTelephonyChoice dict={d} orgSlug="mintral" />
    );
    expect(container).toBeEmptyDOMElement();
    mocks.swr.error = new Error("Synthetic load failure");
    setup({});
    mocks.swr.error = new Error("Synthetic load failure");
    rerender(<OrgTelephonyChoice dict={d} orgSlug="mintral" />);
    expect(container).toBeEmptyDOMElement();
  });
});
