import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ContentReviewPermissionCard from "./content-review-permission-card";

const { permission, save } = vi.hoisted(() => ({
  permission: {
    enabled: true,
    permissionCode: "CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE",
    roleCode: "CONTENT_REVIEW_AUTO_APPROVER",
    alfrescoGroupId: "GROUP_MINTRAL_AUTO_APPROVERS_SITE_MINTRAL",
    assigneeIds: ["antonia"],
    projectionStatus: "SYNCED" as "SYNCED" | "FAILED",
    projectionError: null,
    projectedAt: null,
  },
  save: vi.fn(),
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
    memberPermissionLabel: "Automatic approval for {member}",
    noSearchResults: "No members match your search.",
    readOnly: "Read only",
    readOnlyHelp: "The site manager role is required.",
    noMembers: "No members",
    unavailableMember: "Unavailable",
    projectionFailed: "Projection failed",
    projectionSynced: "Projection synced",
    saveError: "Save error",
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
        canManage
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

  it("renders permissions as read-only for non-managers", () => {
    render(
      <ContentReviewPermissionCard
        orgSlug="mintral"
        members={members}
        membersLoading={false}
        membersError={null}
        canManage={false}
        dict={dict}
      />
    );

    expect(
      screen.getByText("The site manager role is required.")
    ).toBeVisible();
    expect(screen.getByText("Read only")).toBeVisible();
    expect(
      screen.getByRole("switch", { name: "Enable automatic approval" })
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Save permission" })
    ).not.toBeInTheDocument();
  });

  it("allows retrying a failed Alfresco projection without changing settings", () => {
    permission.projectionStatus = "FAILED";

    render(
      <ContentReviewPermissionCard
        orgSlug="mintral"
        members={members}
        membersLoading={false}
        membersError={null}
        canManage
        dict={dict}
      />
    );

    expect(screen.getByText("Projection failed")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Save permission" })
    ).toBeEnabled();

    permission.projectionStatus = "SYNCED";
  });
});
