import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ContentReviewPermissionCard from "./content-review-permission-card";

const { permission, save, ownerRole, saveOwnerRole } = vi.hoisted(() => ({
  permission: {
    enabled: true,
    permissionCode: "CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE",
    roleCode: "CONTENT_REVIEW_AUTO_APPROVER",
    assigneeIds: ["antonia"],
  },
  save: vi.fn(),
  ownerRole: {
    roleCode: "ORGANIZATION_OWNER",
    assigneeIds: ["antonia"],
  },
  saveOwnerRole: vi.fn(),
}));

vi.mock("../hooks/use-organization-owner-role", () => ({
  useOrganizationOwnerRole: () => ({
    role: ownerRole,
    isLoading: false,
    isSaving: false,
    error: null,
    save: saveOwnerRole,
  }),
}));

vi.mock("../hooks/use-content-review-permission", () => ({
  useContentReviewPermission: () => ({
    permission,
    isLoading: false,
    isSaving: false,
    error: null,
    save,
  }),
}));

const dict = {
  loading: "Loading",
  membersTitle: "Members",
  contentReviewPermission: {
    accessTitle: "Access and permissions",
    accessDescription: "Manage access",
    memberCount: "{count} members",
    loadError: "Load error",
    enabledLabel: "Enable automatic approval",
    enabledHelp: "Help",
    assignedCount: "{count} with automatic approval",
    searchLabel: "Search members",
    searchPlaceholder: "Search by name or email…",
    memberColumn: "Member",
    accessColumn: "Access",
    permissionColumn: "Automatic approval",
    memberAccess: "Member",
    ownerAccess: "Owner",
    memberRoleLabel: "Organization role for {member}",
    lastOwnerHelp: "Promote another member first.",
    memberPermissionLabel: "Automatic approval for {member}",
    noSearchResults: "No members match your search.",
    readOnly: "Read only",
    readOnlyHelp: "The site manager role is required.",
    noMembers: "No members",
    unavailableMember: "Unavailable",
    saveError: "Save error",
    roleSaveError: "Role save error",
    save: "Save permission",
    saving: "Saving",
  },
};

const members = [
  {
    id: "antonia",
    email: "antonia@example.com",
    firstName: "Antonia",
    lastName: "Candia",
    displayName: "Antonia Candia",
  },
  {
    id: "gabriel",
    email: "gabriel@example.com",
    firstName: "Gabriel",
    lastName: "Atencio",
    displayName: "Gabriel Atencio",
  },
];

describe("ContentReviewPermissionCard", () => {
  it("combines searchable members with per-user permission assignment", async () => {
    const user = userEvent.setup();
    render(
      <ContentReviewPermissionCard
        orgSlug="mintral"
        members={members}
        membersLoading={false}
        membersError={null}
        dict={dict}
      />
    );

    expect(screen.getByText("Access and permissions")).toBeInTheDocument();
    expect(screen.getByText("2 members")).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Search by name or email…"),
      "gabriel"
    );
    expect(screen.queryByText("Antonia Candia")).not.toBeInTheDocument();
    expect(screen.getByText("Gabriel Atencio")).toBeInTheDocument();

    await user.click(
      screen.getByRole("switch", {
        name: "Automatic approval for Gabriel Atencio",
      })
    );
    await user.click(screen.getByRole("button", { name: "Save permission" }));

    expect(save).toHaveBeenCalledWith({
      enabled: true,
      assigneeIds: ["antonia", "gabriel"],
    });
  });

  it("promotes a member to organization owner", async () => {
    const user = userEvent.setup();
    render(
      <ContentReviewPermissionCard
        orgSlug="mintral"
        members={members}
        membersLoading={false}
        membersError={null}
        dict={dict}
      />
    );

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Organization role for Gabriel Atencio",
      }),
      "OWNER"
    );

    expect(saveOwnerRole).toHaveBeenCalledWith({
      assigneeIds: ["antonia", "gabriel"],
    });
  });

  it("does not offer a save when the application permission is unchanged", () => {
    render(
      <ContentReviewPermissionCard
        orgSlug="mintral"
        members={members}
        membersLoading={false}
        membersError={null}
        dict={dict}
      />
    );

    expect(
      screen.getByRole("button", { name: "Save permission" })
    ).toBeDisabled();
  });
});
