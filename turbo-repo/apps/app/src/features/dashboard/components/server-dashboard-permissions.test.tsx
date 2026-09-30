import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ServerDashboardPermissions } from "./server-dashboard-permissions";
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key.split(".").at(-1),
}));
vi.mock("@/features/common/hooks/use-unsaved-navigation", () => ({
  useUnsavedNavigation: vi.fn(),
}));
afterEach(() => vi.unstubAllGlobals());
function setup(allowed = true) {
  const assignments = [{ authorityId: "retained", role: "Consumer" as const }];
  return {
    key: (slug?: string) => `/api/dashboards/${slug}?org=test`,
    capabilities: vi
      .fn()
      .mockResolvedValue({
        canManagePermissions: allowed,
        canEdit: false,
        readOnly: true,
        canDelete: false,
        canShare: false,
      }),
    permissions: vi.fn().mockResolvedValue({ assignments }),
    setPermissions: vi.fn().mockResolvedValue(undefined),
  };
}
it("requires confirmation and keeps existing assignments when adding an explicit identity", async () => {
  const client = setup();
  const confirm = vi.fn(() => false);
  vi.stubGlobal("confirm", confirm);
  render(
    <ServerDashboardPermissions
      client={client}
      slug="costs"
      sessionKey="one"
      dictionary={{}}
      onClose={vi.fn()}
    />
  );
  const input = await screen.findByRole("textbox", { name: "authorityId" });
  fireEvent.change(input, { target: { value: " exact-subject " } });
  fireEvent.change(screen.getByRole("combobox", { name: "authorityId" }), {
    target: { value: "exact-subject" },
  });
  fireEvent.click(screen.getByRole("button", { name: "addButton" }));
  expect(client.setPermissions).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(confirm).toHaveBeenCalledWith("confirmSave");
  expect(client.setPermissions).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(client.setPermissions).toHaveBeenCalledWith(
      "costs",
      [
        { authorityId: "retained", role: "Consumer" },
        { authorityId: "exact-subject", role: "Consumer" },
      ],
      expect.any(AbortSignal)
    )
  );
  expect(await screen.findByText("saveSuccess")).toBeTruthy();
});
it("does not load the directory or expose identity entry without permission capability", async () => {
  const client = setup(false);
  render(
    <ServerDashboardPermissions
      client={client}
      slug="costs"
      sessionKey="one"
      dictionary={{}}
      onClose={vi.fn()}
    />
  );
  expect(await screen.findByText("notAuthorized")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(client.permissions).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(client.setPermissions).not.toHaveBeenCalled();
});
