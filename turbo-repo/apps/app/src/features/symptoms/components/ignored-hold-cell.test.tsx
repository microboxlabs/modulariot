import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useTreatmentsGeneral } from "../hooks/use-treatments-general";
import IgnoredHoldCell from "./ignored-hold-cell";

const mocks = vi.hoisted(() => ({
  resume: vi.fn(),
  disabled: false,
  notify: vi.fn(),
}));
vi.mock("../control-tower/control-tower-api", () => ({
  resumeTreatment: mocks.resume,
}));
vi.mock("./map-view/prototype/prototype-api-guard", () => ({
  isPrototypeApiDisabled: () => mocks.disabled,
}));
vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: mocks.notify,
}));

const dict: I18nRecord = {
  symptoms: {
    ignored_badge: "Ignorado",
    ignored_left: "quedan",
    resume: "Reanudar",
    resume_done: "Reanudado",
    resume_error: "Error",
  },
};
const ignored = {
  treatment_id: "hold-1",
  since: "2026-11-03T12:00:00Z",
  until: "2026-11-03T12:30:00Z",
  until_trip_end: false,
  scope: "CASE",
  by: "operator",
};

function Treatment() {
  const { treatmentData } = useTreatmentsGeneral("-7");
  if (!treatmentData) return null;
  return (
    <>
      {treatmentData.symptom_info?.ignored && (
        <IgnoredHoldCell
          info={treatmentData.symptom_info.ignored}
          dict={dict}
        />
      )}
      <span>
        {treatmentData.timeline?.length ? "Fin de ignorar" : "En pausa"}
      </span>
    </>
  );
}

function showTreatment() {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Treatment />
    </SWRConfig>
  );
}

beforeEach(() => {
  mocks.disabled = false;
  mocks.resume.mockReset().mockResolvedValue({});
  mocks.notify.mockReset();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ symptom_info: { ignored }, timeline: [] }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ symptom_info: {}, timeline: [{}] }),
      })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("resume an ignored case", () => {
  it("refreshes the treatment header and its timeline after resuming", async () => {
    showTreatment();
    fireEvent.click(await screen.findByRole("button", { name: "Reanudar" }));
    await waitFor(() => expect(mocks.resume).toHaveBeenCalledWith("hold-1"));
    await screen.findByText("Fin de ignorar");
    expect(
      screen.queryByRole("button", { name: "Reanudar" })
    ).not.toBeInTheDocument();
    expect(mocks.notify).toHaveBeenCalledWith({
      type: "success",
      message: "Reanudado",
    });
  });

  it("respects the prototype API-disable guard", async () => {
    mocks.disabled = true;
    showTreatment();
    const button = await screen.findByRole("button", { name: "Reanudar" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.resume).not.toHaveBeenCalled();
  });
});
