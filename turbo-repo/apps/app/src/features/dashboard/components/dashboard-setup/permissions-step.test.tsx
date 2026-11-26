import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { PermissionsStep } from "./permissions-step";

it("shares by email when the directory is unavailable, validating input and duplicates", async () => {
  const onChange = vi.fn();
  const props = {
    assignments: [],
    onChange,
    principals: [
      { authorityId: "team:ops", kind: "team" as const, name: "Ops" },
    ],
    loading: false,
    canManage: true,
    t: (key: string) => key,
  };
  const { rerender } = render(<PermissionsStep {...props} />);
  const user = userEvent.setup();
  const email = screen.getByRole("textbox", { name: "email" });
  await user.type(email, "invalid");
  await user.click(screen.getByRole("button", { name: "addEmail" }));
  expect(onChange).not.toHaveBeenCalled();
  await user.clear(email);
  await user.type(email, "ana@acme.io");
  await user.click(screen.getByRole("button", { name: "addEmail" }));
  expect(onChange).toHaveBeenCalledWith([
    { authorityId: "ana@acme.io", role: "Consumer" },
  ]);
  rerender(
    <PermissionsStep
      {...props}
      assignments={[{ authorityId: "ana@acme.io", role: "Consumer" }]}
    />
  );
  await user.type(email, "ana@Acme.io");
  expect(screen.getByRole("button", { name: "addEmail" })).toBeDisabled();
});

it("distinguishes unknown teams in labels and accessible action names", () => {
  render(
    <PermissionsStep
      assignments={[
        { authorityId: "team:ops", role: "Consumer" },
        { authorityId: "team:support", role: "Consumer" },
      ]}
      onChange={vi.fn()}
      principals={[]}
      loading={false}
      canManage
      t={(key, params) => (params?.name ? `${key}: ${params.name}` : key)}
    />
  );
  for (const id of ["team:ops", "team:support"]) {
    expect(screen.getByText(`unknownTeam (${id})`)).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: `roleOf: unknownTeam (${id})` })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: `removePerson: unknownTeam (${id})` })
    ).toBeVisible();
  }
});
