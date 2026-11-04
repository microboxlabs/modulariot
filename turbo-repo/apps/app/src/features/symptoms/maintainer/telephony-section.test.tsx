import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import TelephonySection from "./telephony-section";

const mocks = vi.hoisted(() => {
  const setup = {
    preferred: null,
    active: {
      connectionId: "t1",
      provider: "TELNYX",
      name: "Central",
      callerNumber: "+56900000000",
      ready: true,
      managed: false,
    },
    lines: [
      {
        connectionId: "t1",
        provider: "TELNYX",
        name: "Central",
        callerNumber: "+56900000000",
        ready: true,
      },
      {
        connectionId: "m1",
        provider: "TEAMS_PHONE",
        name: "Teams",
        callerNumber: null,
        ready: false,
      },
    ],
  };
  return {
    swr: { data: setup, error: undefined },
    saveTelephony: vi.fn().mockResolvedValue(setup),
  };
});

vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
const scopes = vi.hoisted(() => ({ activeOrg: { slug: "acme" } }));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({ useOrgScopes: () => scopes })
);
const month = vi.hoisted(() => ({
  data: {
    usage: { usedMinutes: 12, quotaMinutes: 300, pending: 1, chargeUsd: 0.6 },
  },
  error: null,
}));
vi.mock("@/features/telephony/use-org-telephony-usage", () => ({
  useOrgTelephonyUsage: () => month,
}));
vi.mock("../control-tower/telephony-api", () => ({
  useTelephony: () => mocks.swr,
  saveTelephony: mocks.saveTelephony,
}));

const d = es.pages.userSettings.symptomCatalog as unknown as I18nRecord;

describe("TelephonySection", () => {
  it("shows the line in use and the one that did not pass its test", () => {
    render(<TelephonySection d={d} />);
    expect(screen.getByText(/Central · Telnyx/)).toBeTruthy();
    expect(
      screen.getByText("Teams no pasó su prueba; no se usa hasta que la pase.")
    ).toBeTruthy();
  });

  it("shows the month on the platform line", () => {
    mocks.swr.data.active.managed = true;
    render(<TelephonySection d={d} />);
    expect(screen.getByText(/línea de la plataforma/)).toBeTruthy();
    expect(screen.getByText(/12 de 300 minutos/)).toBeTruthy();
    mocks.swr.data.active.managed = false;
  });

  it("saves the choice on change", async () => {
    render(<TelephonySection d={d} />);
    fireEvent.change(screen.getByLabelText('Telefonía de "Llamar a"'), {
      target: { value: "TEAMS_PHONE" },
    });
    await waitFor(() =>
      expect(mocks.saveTelephony).toHaveBeenCalledWith("TEAMS_PHONE")
    );
  });
});
