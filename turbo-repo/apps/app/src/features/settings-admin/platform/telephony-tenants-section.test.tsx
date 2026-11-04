import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import TelephonyTenantsSection from "./telephony-tenants-section";

const { saveMinutes } = vi.hoisted(() => ({
  saveMinutes: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./use-telephony-plan", () => ({
  useTelephonyTenants: () => ({
    organizations: [],
    isLoading: false,
    error: null,
    saveMinutes,
  }),
}));
vi.mock("./use-platform-organizations", () => ({
  usePlatformOrganizations: () => ({
    organizations: [{ slug: "new-org", name: "New organization" }],
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("initial managed minutes", () => {
  it("assigns minutes before an organization has any usage or subscription", async () => {
    const dict = es.pages.userSettings.platform.telephonyTenants;
    render(<TelephonyTenantsSection dict={dict} />);
    fireEvent.change(
      screen.getByRole("combobox", { name: dict.organization }),
      { target: { value: "new-org" } }
    );
    fireEvent.click(screen.getByRole("button", { name: dict.editMinutes }));
    fireEvent.change(screen.getByLabelText(dict.monthlyMinutes), {
      target: { value: "120" },
    });
    fireEvent.click(screen.getByRole("button", { name: dict.save }));
    await waitFor(() =>
      expect(saveMinutes).toHaveBeenCalledWith("new-org", 120)
    );
  });
});
