import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    pathname: "/app/es/users/settings/organizations",
    isPlatformOwner: false,
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("../platform/use-platform-membership", () => ({
  useIsPlatformOwner: () => ({
    isPlatformOwner: state.isPlatformOwner,
    isLoading: false,
  }),
}));

import { NoOrganizationGate } from "./no-organization-gate";

const d = { noAccessTitle: "No access yet", noAccessAsk: "Ask an admin" };

function renderGate() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <NoOrganizationGate d={d}>
        <p>page content</p>
      </NoOrganizationGate>
    </SWRConfig>
  );
}

beforeEach(() => {
  // The scopes route answers 403: the caller belongs to no organization.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/api/user/scopes")
        ? new Response(null, { status: 403 })
        : new Response("[]", { status: 200 })
    )
  );
  state.pathname = "/app/es/users/settings/organizations";
  state.isPlatformOwner = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NoOrganizationGate without an organization", () => {
  it("lets a platform owner open Settings › Organizations", async () => {
    state.isPlatformOwner = true;

    renderGate();

    expect(await screen.findByText("page content")).toBeInTheDocument();
    expect(screen.queryByText("No access yet")).not.toBeInTheDocument();
  });

  it("keeps a user who is not a platform owner out of Settings › Organizations", async () => {
    renderGate();

    expect(await screen.findByText("No access yet")).toBeInTheDocument();
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  it("keeps a platform owner out of other pages", async () => {
    state.isPlatformOwner = true;
    state.pathname = "/app/es/symptoms";

    renderGate();

    expect(await screen.findByText("No access yet")).toBeInTheDocument();
  });
});
