import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrgServiceAccountCard from "./org-service-account-card";
import type { OrgServiceAccountState } from "./org-service-account";

const hook = vi.hoisted(() => ({
  state: undefined as OrgServiceAccountState | undefined,
  mutate: vi.fn(),
}));
const calls = vi.hoisted(() => ({
  set: vi.fn(),
  check: vi.fn(),
}));

vi.mock("./org-service-account", () => ({
  useOrgServiceAccount: () => ({
    state: hook.state,
    error: undefined,
    isLoading: false,
    mutate: hook.mutate,
  }),
  setOrgServiceAccount: calls.set,
  checkOrgServiceAccount: calls.check,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const dict = {
  serviceAccount: {
    none: "Created from Connections",
    notConfigured: "Not configured",
    check: "Test access",
    checkOk: "OK until {until}",
    disable: "Disable",
    enable: "Enable",
    active: "Active",
    disabled: "Disabled",
  },
};

const account = {
  email: "t-acme@tenants-p.iam.gserviceaccount.com",
  accountId: "t-acme",
  disabled: false,
  createdAt: "2026-10-29T12:00:00Z",
  createdBy: "owner@example.com",
  updatedAt: "2026-10-29T12:00:00Z",
  updatedBy: "owner@example.com",
};

describe("OrgServiceAccountCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("says so when the platform has no project", () => {
    hook.state = { configured: false, projectId: null, account: null };
    render(<OrgServiceAccountCard slug="acme" dict={dict} lang="es" />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  it("points to Connections when the organization has no account", () => {
    hook.state = { configured: true, projectId: "tenants-p", account: null };
    render(<OrgServiceAccountCard slug="acme" dict={dict} lang="es" />);
    expect(screen.getByText("Created from Connections")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("tests access and disables an active account", async () => {
    hook.state = { configured: true, projectId: "tenants-p", account };
    calls.check.mockResolvedValue({
      disabled: false,
      tokenExpiresAt: "2026-10-29T12:05:00Z",
    });
    calls.set.mockResolvedValue({
      configured: true,
      projectId: "tenants-p",
      account: { ...account, disabled: true },
    });
    render(<OrgServiceAccountCard slug="acme" dict={dict} lang="es" />);
    expect(screen.getByText(account.email)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Test access"));
    expect(await screen.findByText(/^OK until/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Disable"));
    await waitFor(() =>
      expect(calls.set).toHaveBeenCalledWith("acme", "disable")
    );
  });
});
