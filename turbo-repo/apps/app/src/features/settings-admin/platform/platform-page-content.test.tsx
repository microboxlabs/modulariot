import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { membership, nav } = vi.hoisted(() => ({
  membership: { isPlatformOwner: false, isLoading: false },
  nav: { query: "", listeners: new Set<() => void>() },
}));

vi.mock("next/navigation", async () => {
  const React = await import("react");
  return {
    usePathname: () => "/en/users/settings/platform",
    useSearchParams: () =>
      new URLSearchParams(
        React.useSyncExternalStore(
          (listener) => {
            nav.listeners.add(listener);
            return () => nav.listeners.delete(listener);
          },
          () => nav.query
        )
      ),
    useRouter: () => ({
      push: vi.fn(),
      replace: (url: string) => {
        nav.query = url.split("?")[1] ?? "";
        nav.listeners.forEach((listener) => listener());
      },
    }),
  };
});

vi.mock("./use-platform-membership", () => ({
  useIsPlatformOwner: () => membership,
}));
vi.mock("./branding-section", () => ({
  default: () => <div>branding section</div>,
}));
vi.mock("./platform-owners-card", () => ({
  default: () => <div>superusers section</div>,
}));

import PlatformPageContent from "./platform-page-content";

const dict = {
  breadcrumb: { user: "User", settings: "Settings", platform: "Platform" },
  platform: {
    title: "Platform",
    description: "Settings that belong to no organization.",
    listTitle: "Platform settings",
    notOwnerTitle: "You don't have access to this section",
    notOwnerBody: "Only platform administrators can change these settings.",
    branding: { title: "Branding", menuHint: "One logo per domain" },
    superusers: {
      title: "Superusers",
      menuHint: "Who administers the platform",
    },
  },
};

beforeEach(() => {
  nav.query = "";
  membership.isPlatformOwner = false;
  membership.isLoading = false;
});

describe("PlatformPageContent", () => {
  it("opens on Branding, with the menu beside it", () => {
    membership.isPlatformOwner = true;
    render(<PlatformPageContent dict={dict} rootDict={{}} lang="en" />);

    expect(screen.getByText("Platform settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Branding/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByText("branding section")).toBeInTheDocument();
    expect(screen.queryByText("superusers section")).not.toBeInTheDocument();
  });

  it("opens the section named in the address", () => {
    membership.isPlatformOwner = true;
    nav.query = "section=superusers";
    render(<PlatformPageContent dict={dict} rootDict={{}} lang="en" />);

    expect(screen.getByText("superusers section")).toBeInTheDocument();
  });

  it("swaps the right column when another section is picked", async () => {
    membership.isPlatformOwner = true;
    const user = userEvent.setup();
    render(<PlatformPageContent dict={dict} rootDict={{}} lang="en" />);

    await user.click(screen.getByRole("button", { name: /Superusers/ }));

    expect(screen.getByText("superusers section")).toBeInTheDocument();
    expect(screen.queryByText("branding section")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Superusers/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("offers no menu and no sections to anyone but a platform owner", () => {
    render(<PlatformPageContent dict={dict} rootDict={{}} lang="en" />);

    expect(screen.queryByText("Platform settings")).not.toBeInTheDocument();
    expect(screen.queryByText("branding section")).not.toBeInTheDocument();
    expect(
      screen.getByText("You don't have access to this section")
    ).toBeInTheDocument();
  });

  it("says nothing either way until the check resolves", () => {
    membership.isLoading = true;
    render(<PlatformPageContent dict={dict} rootDict={{}} lang="en" />);

    expect(screen.queryByText("branding section")).not.toBeInTheDocument();
    expect(
      screen.queryByText("You don't have access to this section")
    ).not.toBeInTheDocument();
  });

  it("keeps the page heading visible whether or not the caller is an owner", () => {
    render(<PlatformPageContent dict={dict} rootDict={{}} lang="en" />);

    expect(
      screen.getByRole("heading", { name: "Platform" })
    ).toBeInTheDocument();
  });
});
