import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { GeographicProfileProvider } from "./geographic-profile-context";
import ProfileDropdown from "./profile-dropdown";

const dict = {
  geographic_view: {
    profiles: {
      label: "Profile",
      admin: "Admin",
      other: "Other",
      comingSoon: "coming soon",
    },
  },
} as unknown as I18nRecord;

describe("ProfileDropdown", () => {
  it("shows Admin as the current profile", () => {
    render(
      <GeographicProfileProvider>
        <ProfileDropdown dict={dict} />
      </GeographicProfileProvider>
    );
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
  });

  it("lists Other as coming soon", () => {
    render(
      <GeographicProfileProvider>
        <ProfileDropdown dict={dict} />
      </GeographicProfileProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Admin" }));
    expect(screen.getByText(/Other/)).toBeInTheDocument();
    expect(screen.getByText(/coming soon/)).toBeInTheDocument();
  });
});
