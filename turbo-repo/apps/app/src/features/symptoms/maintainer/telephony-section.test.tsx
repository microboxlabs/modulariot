import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("../control-tower/telephony-api", () => ({
  useTelephony: () => mocks.swr,
  saveTelephony: mocks.saveTelephony,
}));

const d = es.pages.userSettings.symptomCatalog as unknown as I18nRecord;

describe("TelephonySection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("explains immediate saving and re-enables the selector after a failed save", async () => {
    mocks.saveTelephony.mockRejectedValueOnce(
      new Error("Synthetic save failure")
    );
    render(<TelephonySection d={d} />);
    expect(
      screen.getByText(
        es.pages.userSettings.symptomCatalog.telephonySavesImmediately
      )
    ).toBeInTheDocument();
    const select = screen.getByLabelText('Telefonía de "Llamar a"');
    fireEvent.change(select, { target: { value: "TEAMS_PHONE" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.pages.userSettings.symptomCatalog.telephonySaveFailed
    );
    await waitFor(() => expect(select).toBeEnabled());
  });

  it("shows the line in use and the one that did not pass its test", () => {
    render(<TelephonySection d={d} />);
    expect(screen.getByText(/Central · Telnyx/)).toBeTruthy();
    expect(
      screen.getByText("Teams no pasó su prueba; no se usa hasta que la pase.")
    ).toBeTruthy();
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
