import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import TelephonyPlanSection from "./telephony-plan-section";

const state = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(undefined),
  plan: {
    minutesPerMonth: 300,
    clMobileUsd: 0.05,
    clLandlineUsd: 0.03,
    otherUsd: 0.2,
    whatsappCallUsd: 0.01,
    whatsappTemplateUsd: 0.02,
    enforced: false,
    updatedBy: null,
    updatedAt: null,
  },
}));
vi.mock("./use-telephony-plan", () => ({
  useTelephonyPlan: () => ({
    plan: state.plan,
    isLoading: false,
    error: null,
    save: state.save,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const dict = es.pages.userSettings.platform.telephonyPlan;

beforeEach(() => state.save.mockClear());

describe("telephony plan", () => {
  it("shows the geocoding plan's parts: hint, switch help, number fields", () => {
    render(<TelephonyPlanSection dict={dict} />);
    expect(screen.getByText(dict.providerHint)).toBeInTheDocument();
    expect(screen.getByText(dict.enforcedOff)).toBeInTheDocument();
    const minutes = screen.getByLabelText(dict.fields.minutesPerMonth);
    expect(minutes).toHaveAttribute("type", "number");
    expect(minutes).toHaveValue(300);
    expect(screen.getByLabelText(dict.fields.whatsappTemplateUsd)).toHaveValue(
      0.02
    );
  });

  it("names the field that is wrong and does not save", async () => {
    const user = userEvent.setup();
    render(<TelephonyPlanSection dict={dict} />);
    await user.clear(screen.getByLabelText(dict.fields.otherUsd));
    await user.click(screen.getByRole("button", { name: dict.save }));
    expect(screen.getByText(dict.errors.otherUsd)).toBeInTheDocument();
    expect(state.save).not.toHaveBeenCalled();
  });

  it("saves the prices and the switch", async () => {
    const user = userEvent.setup();
    render(<TelephonyPlanSection dict={dict} />);
    await user.click(screen.getByRole("switch"));
    expect(screen.getByText(dict.enforcedOn)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: dict.save }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          minutesPerMonth: 300,
          clMobileUsd: 0.05,
          enforced: true,
        })
      )
    );
  });
});
