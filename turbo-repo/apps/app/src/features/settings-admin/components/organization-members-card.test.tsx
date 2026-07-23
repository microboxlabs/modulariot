import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OrganizationMembersCard from "./organization-members-card";

const dict = {
  membersTitle: "Members",
  membersDescription: "People with access.",
  membersEmpty: "No members",
  loading: "Loading",
  loadError: "Load error",
};

describe("OrganizationMembersCard", () => {
  it("shows the roster without exposing roles or permissions", () => {
    render(
      <OrganizationMembersCard
        members={[
          {
            id: "member@example.com",
            email: "member@example.com",
            firstName: "Regular",
            lastName: "Member",
            displayName: "Regular Member",
          },
        ]}
        isLoading={false}
        error={null}
        dict={dict}
      />
    );

    expect(screen.getByText("Regular Member")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
