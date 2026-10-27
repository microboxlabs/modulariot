import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrgDetailPanel from "./org-detail-panel";

vi.mock("../hooks/use-org-modules", () => ({
  useOrgModules: () => ({ modules: [], isLoading: false, error: undefined }),
}));

vi.mock("./modules-list", () => ({ default: () => null }));
vi.mock("../gps-webhooks/gps-webhook-card", () => ({
  default: () => <div data-testid="gps-webhooks" />,
}));
vi.mock("../whatsapp/whatsapp-channel-card", () => ({
  default: () => <div data-testid="whatsapp-channel" />,
}));

describe("OrgDetailPanel", () => {
  it("shows GPS webhooks to an owner; WhatsApp and email are in Comunicaciones", () => {
    render(
      <OrgDetailPanel
        organization={{
          id: 1,
          slug: "mintral",
          displayName: "Mintral",
          taxId: null,
          role: "OWNER",
          isParent: true,
        }}
        dict={{}}
      />
    );

    expect(screen.queryByTestId("whatsapp-channel")).toBeNull();
    expect(screen.getByTestId("gps-webhooks")).toBeInTheDocument();
  });

  it("hides organization settings from regular members", () => {
    render(
      <OrgDetailPanel
        organization={{
          id: 1,
          slug: "mintral",
          displayName: "Mintral",
          taxId: null,
          role: "MEMBER",
          isParent: true,
        }}
        dict={{}}
      />
    );

    expect(screen.queryByTestId("whatsapp-channel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("gps-webhooks")).not.toBeInTheDocument();
  });

  it("does not treat an Alfresco site role as application ownership", () => {
    render(
      <OrgDetailPanel
        organization={{
          id: 1,
          slug: "mintral",
          displayName: "Mintral",
          taxId: null,
          role: "SITE_MANAGER",
          isParent: true,
        }}
        dict={{}}
      />
    );

    expect(screen.queryByTestId("whatsapp-channel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("gps-webhooks")).not.toBeInTheDocument();
  });
});
