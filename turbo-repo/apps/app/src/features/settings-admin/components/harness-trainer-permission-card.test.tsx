import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HarnessTrainerPermissionCard from "./harness-trainer-permission-card";

const { permission, save, ownerRole } = vi.hoisted(() => ({
  permission: {
    enabled: true,
    permissionCode: "HARNESS_TRAINER",
    roleCode: "HARNESS_TRAINER",
    assigneeIds: ["bruno"],
  },
  save: vi.fn(),
  ownerRole: {
    roleCode: "ORGANIZATION_OWNER",
    assigneeIds: ["ana"],
  },
}));

vi.mock("../hooks/use-organization-owner-role", () => ({
  useOrganizationOwnerRole: () => ({
    role: ownerRole,
    isLoading: false,
    isSaving: false,
    error: null,
    save: vi.fn(),
  }),
}));

vi.mock("../hooks/use-harness-trainer-permission", () => ({
  useHarnessTrainerPermission: () => ({
    permission,
    isLoading: false,
    isSaving: false,
    error: null,
    save,
  }),
}));

const dict = {
  loading: "Loading",
  harnessTrainerPermission: {
    title: "Assistant trainers",
    description: "Trainers teach the assistant.",
    ownersNote: "Organization owners are always trainers.",
    enabledLabel: "Enable trainers",
    enabledHelp: "Help",
    assignedCount: "{count} trainers assigned",
    searchLabel: "Search members",
    searchPlaceholder: "Search by name or email…",
    ownerBadge: "Owner",
    memberPermissionLabel: "Trainer permission for {member}",
    noSearchResults: "No members match your search.",
    noMembers: "No members",
    unavailableMember: "Unavailable",
    loadError: "Load error",
    saveError: "Save error",
    save: "Save trainers",
    saving: "Saving",
  },
};

const members = [
  {
    id: "ana",
    email: "ana@example.com",
    firstName: "Ana",
    lastName: "Owner",
    displayName: "Ana Owner",
  },
  {
    id: "bruno",
    email: "bruno@example.com",
    firstName: "Bruno",
    lastName: "Trainer",
    displayName: "Bruno Trainer",
  },
  {
    id: "carla",
    email: "carla@example.com",
    firstName: "Carla",
    lastName: "Member",
    displayName: "Carla Member",
  },
];

function renderCard() {
  render(
    <HarnessTrainerPermissionCard
      orgSlug="acme"
      members={members}
      membersLoading={false}
      membersError={null}
      dict={dict}
    />
  );
}

describe("HarnessTrainerPermissionCard", () => {
  beforeEach(() => save.mockReset());

  it("explains that owners are always trainers and locks their switch", () => {
    renderCard();

    expect(screen.getByText("Assistant trainers")).toBeInTheDocument();
    expect(
      screen.getByText("Organization owners are always trainers.")
    ).toBeInTheDocument();
    const ownerSwitch = screen.getByRole("switch", {
      name: "Trainer permission for Ana Owner",
    });
    expect(ownerSwitch).toBeChecked();
    expect(ownerSwitch).toBeDisabled();
    expect(
      screen.getByRole("switch", {
        name: "Trainer permission for Bruno Trainer",
      })
    ).toBeChecked();
  });

  it("saves the full assignee list", async () => {
    const user = userEvent.setup();
    renderCard();

    expect(
      screen.getByRole("button", { name: "Save trainers" })
    ).toBeDisabled();

    await user.click(
      screen.getByRole("switch", {
        name: "Trainer permission for Carla Member",
      })
    );
    await user.click(
      screen.getByRole("switch", {
        name: "Trainer permission for Bruno Trainer",
      })
    );
    await user.click(screen.getByRole("button", { name: "Save trainers" }));

    expect(save).toHaveBeenCalledWith({
      enabled: true,
      assigneeIds: ["carla"],
    });
  });

  it("saves the enabled flag", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("switch", { name: "Enable trainers" }));
    await user.click(screen.getByRole("button", { name: "Save trainers" }));

    expect(save).toHaveBeenCalledWith({
      enabled: false,
      assigneeIds: ["bruno"],
    });
  });
});
