import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { membership } = vi.hoisted(() => ({
  membership: { isPlatformOwner: false, isLoading: false },
}));

vi.mock("./use-platform-membership", () => ({
  useIsPlatformOwner: () => membership,
}));
vi.mock("./domain-branding-card", () => ({
  default: () => <div>domains card</div>,
}));
vi.mock("./platform-owners-card", () => ({
  default: () => <div>owners card</div>,
}));

import BrandingPageContent from "./branding-page-content";

const dict = {
  breadcrumb: { user: "User", settings: "Settings", branding: "Branding" },
  branding: {
    title: "Branding by domain",
    description: "Set the logo shown on each domain.",
    notOwnerTitle: "You don't have access to this section",
    notOwnerBody: "Only platform administrators can configure branding.",
  },
};

beforeEach(() => {
  membership.isPlatformOwner = false;
  membership.isLoading = false;
});

describe("BrandingPageContent", () => {
  it("shows both panels to a platform owner", () => {
    membership.isPlatformOwner = true;
    render(<BrandingPageContent dict={dict} lang="en" />);

    expect(screen.getByText("domains card")).toBeInTheDocument();
    expect(screen.getByText("owners card")).toBeInTheDocument();
  });

  it("offers nothing to administer to anyone else", () => {
    render(<BrandingPageContent dict={dict} lang="en" />);

    expect(screen.queryByText("domains card")).not.toBeInTheDocument();
    expect(screen.queryByText("owners card")).not.toBeInTheDocument();
    expect(
      screen.getByText("You don't have access to this section")
    ).toBeInTheDocument();
  });

  it("says nothing either way until the check resolves", () => {
    membership.isLoading = true;
    render(<BrandingPageContent dict={dict} lang="en" />);

    expect(screen.queryByText("domains card")).not.toBeInTheDocument();
    expect(
      screen.queryByText("You don't have access to this section")
    ).not.toBeInTheDocument();
  });
});
