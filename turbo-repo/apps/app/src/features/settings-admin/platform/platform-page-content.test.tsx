import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { membership } = vi.hoisted(() => ({
  membership: { isPlatformOwner: false, isLoading: false },
}));

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
  membership.isPlatformOwner = false;
  membership.isLoading = false;
});

describe("PlatformPageContent", () => {
  it("opens on Branding, with the menu beside it", () => {
    membership.isPlatformOwner = true;
    render(<PlatformPageContent dict={dict} lang="en" />);

    expect(screen.getByText("Platform settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Branding/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByText("branding section")).toBeInTheDocument();
    expect(screen.queryByText("superusers section")).not.toBeInTheDocument();
  });

  it("swaps the right column when another section is picked", async () => {
    membership.isPlatformOwner = true;
    const user = userEvent.setup();
    render(<PlatformPageContent dict={dict} lang="en" />);

    await user.click(screen.getByRole("button", { name: /Superusers/ }));

    expect(screen.getByText("superusers section")).toBeInTheDocument();
    expect(screen.queryByText("branding section")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Superusers/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("offers no menu and no sections to anyone but a platform owner", () => {
    render(<PlatformPageContent dict={dict} lang="en" />);

    expect(screen.queryByText("Platform settings")).not.toBeInTheDocument();
    expect(screen.queryByText("branding section")).not.toBeInTheDocument();
    expect(
      screen.getByText("You don't have access to this section")
    ).toBeInTheDocument();
  });

  it("says nothing either way until the check resolves", () => {
    membership.isLoading = true;
    render(<PlatformPageContent dict={dict} lang="en" />);

    expect(screen.queryByText("branding section")).not.toBeInTheDocument();
    expect(
      screen.queryByText("You don't have access to this section")
    ).not.toBeInTheDocument();
  });

  it("keeps the page heading visible whether or not the caller is an owner", () => {
    render(<PlatformPageContent dict={dict} lang="en" />);

    expect(
      screen.getByRole("heading", { name: "Platform" })
    ).toBeInTheDocument();
  });
});
