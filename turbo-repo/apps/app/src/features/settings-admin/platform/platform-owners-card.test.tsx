import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, save, toast } = vi.hoisted(() => ({
  state: {
    role: {
      roleCode: "PLATFORM_OWNER",
      assigneeIds: ["held@example.test"],
      bootstrapAssigneeIds: ["bootstrap@example.test"],
    },
    isLoading: false,
    isSaving: false,
    error: null as ApiError | null,
  },
  save: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./use-platform-owner-role", () => ({
  usePlatformOwnerRole: () => ({ ...state, save }),
}));
vi.mock("sonner", () => ({ toast }));

import { ApiError } from "../data/json-client";
import PlatformOwnersCard from "./platform-owners-card";

const dict = {
  owners: {
    title: "Platform administrators",
    description: "Who can configure branding for any domain.",
    empty: "No administrators yet.",
    loadError: "Couldn't load the administrator list.",
    saveError: "Couldn't save the change.",
    addLabel: "Administrator email",
    addPlaceholder: "person@example.com",
    add: "Add",
    removeLabel: "Remove {email}",
    added: "Administrator added.",
    removed: "Administrator removed.",
    invalidEmail: "Enter a valid email address.",
    duplicate: "That address is already on the list.",
    lastOwnerHelp: "The last administrator can't be removed.",
    bootstrapBadge: "From configuration",
    bootstrapHelp: "Configured administrators are changed in the deployment.",
  },
};

beforeEach(() => {
  save.mockReset();
  save.mockResolvedValue(undefined);
  state.role = {
    roleCode: "PLATFORM_OWNER",
    assigneeIds: ["held@example.test"],
    bootstrapAssigneeIds: ["bootstrap@example.test"],
  };
  state.isLoading = false;
  state.error = null;
});

describe("PlatformOwnersCard", () => {
  it("marks the configured administrators as read-only", () => {
    render(<PlatformOwnersCard dict={dict} />);

    expect(screen.getByText("bootstrap@example.test")).toBeInTheDocument();
    expect(screen.getByText("From configuration")).toBeInTheDocument();
    // Only the database-held assignee gets a remove control.
    expect(
      screen.getAllByRole("button", { name: /^Remove/ })
    ).toHaveLength(1);
  });

  it("adds a normalized address to the existing list", async () => {
    render(<PlatformOwnersCard dict={dict} />);

    await userEvent.type(
      screen.getByLabelText("Administrator email"),
      "  New@Example.Test  "
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(save).toHaveBeenCalledWith([
      "held@example.test",
      "new@example.test",
    ]);
  });

  it("refuses an address that is not plausibly an email", async () => {
    render(<PlatformOwnersCard dict={dict} />);

    await userEvent.type(screen.getByLabelText("Administrator email"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(save).not.toHaveBeenCalled();
    expect(
      screen.getByText("Enter a valid email address.")
    ).toBeInTheDocument();
  });

  it("refuses an address already on the list", async () => {
    render(<PlatformOwnersCard dict={dict} />);

    await userEvent.type(
      screen.getByLabelText("Administrator email"),
      "held@example.test"
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(save).not.toHaveBeenCalled();
    expect(
      screen.getByText("That address is already on the list.")
    ).toBeInTheDocument();
  });

  it("removes an assignee, sending the remaining list", async () => {
    state.role = {
      roleCode: "PLATFORM_OWNER",
      assigneeIds: ["first@example.test", "second@example.test"],
      bootstrapAssigneeIds: [],
    };
    render(<PlatformOwnersCard dict={dict} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove first@example.test" })
    );

    expect(save).toHaveBeenCalledWith(["second@example.test"]);
  });

  it("will not remove the last way back in", async () => {
    state.role = {
      roleCode: "PLATFORM_OWNER",
      assigneeIds: ["only@example.test"],
      bootstrapAssigneeIds: [],
    };
    render(<PlatformOwnersCard dict={dict} />);

    const remove = screen.getByRole("button", {
      name: "Remove only@example.test",
    });
    expect(remove).toBeDisabled();
    await userEvent.click(remove);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the remove control usable while a configured owner exists", () => {
    render(<PlatformOwnersCard dict={dict} />);

    expect(
      screen.getByRole("button", { name: "Remove held@example.test" })
    ).toBeEnabled();
  });

  it("reports a failed load instead of an empty list", () => {
    state.error = new ApiError({ status: 500, url: "/roles/PLATFORM_OWNER" });
    render(<PlatformOwnersCard dict={dict} />);

    expect(
      screen.getByText("Couldn't load the administrator list.")
    ).toBeInTheDocument();
  });

  it("keeps the address in the field when the write fails", async () => {
    save.mockRejectedValue(new ApiError({ status: 503, url: "/roles" }));
    render(<PlatformOwnersCard dict={dict} />);
    const field = screen.getByLabelText("Administrator email");

    await userEvent.type(field, "new@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // Retrying should not mean typing it again.
    expect(field).toHaveValue("new@example.test");
  });

  it("clears the field once the write lands", async () => {
    render(<PlatformOwnersCard dict={dict} />);
    const field = screen.getByLabelText("Administrator email");

    await userEvent.type(field, "new@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(field).toHaveValue(""));
  });

  it("shows the API's own explanation of a refused write", async () => {
    save.mockRejectedValue(
      new ApiError({
        status: 400,
        url: "/roles",
        message: "Removing every assignee would leave nobody",
      })
    );
    render(<PlatformOwnersCard dict={dict} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove held@example.test" })
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Removing every assignee would leave nobody"
      )
    );
  });

  it("falls back to its own wording when the failure is not the API's", async () => {
    save.mockRejectedValue(new TypeError("cannot read properties of undefined"));
    render(<PlatformOwnersCard dict={dict} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove held@example.test" })
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't save the change.")
    );
  });
});
