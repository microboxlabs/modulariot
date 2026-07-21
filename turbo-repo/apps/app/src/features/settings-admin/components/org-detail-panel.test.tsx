import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrgDetailPanel from "./org-detail-panel";

vi.mock("../hooks/use-org-members", () => ({
  useOrgMembers: () => ({ members: [], isLoading: false, error: undefined }),
}));

vi.mock("../hooks/use-org-modules", () => ({
  useOrgModules: () => ({ modules: [], isLoading: false, error: undefined }),
}));

vi.mock("./content-review-permission-card", () => ({
  default: ({ orgSlug }: Readonly<{ orgSlug: string }>) => (
    <div data-testid="content-review-permission">{orgSlug}</div>
  ),
}));

vi.mock("./modules-list", () => ({ default: () => null }));
vi.mock("../gps-webhooks/gps-webhook-card", () => ({ default: () => null }));
vi.mock("../whatsapp/whatsapp-channel-card", () => ({ default: () => null }));

describe("OrgDetailPanel", () => {
  it("shows content-review permissions for a parent organization without a tax id", () => {
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

    expect(screen.getByTestId("content-review-permission").textContent).toBe(
      "mintral"
    );
  });
});
