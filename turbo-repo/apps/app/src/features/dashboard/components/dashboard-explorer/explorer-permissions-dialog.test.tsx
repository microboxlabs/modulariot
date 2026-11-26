import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import dictionary from "@/lang/en.json";
import ExplorerPermissionsDialog from "./explorer-permissions-dialog";

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));
vi.mock("../dashboard-setup/use-principal-directory", () => ({
  TEAM_AUTHORITY_PREFIX: "team:",
  usePrincipalDirectory: () => ({
    principals: [
      { authorityId: "ana@test.example", kind: "member", name: "Ana" },
    ],
    isLoading: false,
  }),
}));

describe("folder permission saves", () => {
  it.each([true, false])(
    "locks edits while saving and handles success=%s",
    async (success) => {
      const user = userEvent.setup();
      let complete!: () => void;
      let fail!: (error: Error) => void;
      const pending = new Promise<void>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      });
      const save = vi.fn(() => pending);
      const close = vi.fn();
      render(
        <ExplorerPermissionsDialog
          folder={{ id: "ops", name: "Ops" }}
          load={async () => ({
            assignments: [
              { authorityId: "ana@test.example", role: "Consumer" },
            ],
            visibility: "restricted",
          })}
          save={save}
          onClose={close}
          dict={dictionary.dashboard}
        />
      );
      const visibility = await screen.findByRole("radio", {
        name: "Whole organization",
      });
      const restricted = screen.getByRole("radio", {
        name: "Only people with access",
      });
      const role = screen.getByRole("combobox");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(visibility).toBeDisabled();
      expect(role).toBeDisabled();
      await user.click(visibility);
      expect(restricted).toHaveAttribute("aria-checked", "true");
      expect(save).toHaveBeenCalledWith("ops", {
        assignments: [{ authorityId: "ana@test.example", role: "Consumer" }],
        visibility: "restricted",
      });
      await act(async () => {
        if (success) complete();
        else fail(new Error("Unavailable"));
      });
      await waitFor(() => expect(visibility).toBeEnabled());
      expect(role).toBeEnabled();
      expect(close).toHaveBeenCalledTimes(success ? 1 : 0);
      if (!success) {
        await user.click(visibility);
        expect(visibility).toHaveAttribute("aria-checked", "true");
      }
    }
  );
});
