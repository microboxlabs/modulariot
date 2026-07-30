import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useM2MClients } from "../use-m2m-clients";
import { M2MClientCombobox } from "./m2m-client-combobox";

vi.mock("../use-m2m-clients", () => ({
  useM2MClients: vi.fn(),
}));

const CLIENTS = [
  {
    clientId: "existing-id",
    name: "Existing application",
    active: true,
    source: "ORGANIZATION" as const,
  },
  {
    clientId: "other-id",
    name: "Other application",
    active: true,
    source: "DIRECTORY" as const,
  },
];

const DICT = {
  modal: {
    auth0ClientIdPlaceholder: "Search applications",
    auth0DirectoryLoading: "Loading",
    auth0DirectoryError: "Could not load applications",
    auth0DirectoryEmpty: "No applications",
    auth0ClientOwned: "Organization",
    auth0ClientInactive: "Inactive",
  },
};

const mockedUseM2MClients = vi.mocked(useM2MClients);

beforeEach(() => {
  mockedUseM2MClients.mockReturnValue({
    clients: CLIENTS,
    isLoading: false,
    error: undefined,
  });
});

function setup() {
  const onChange = vi.fn();
  render(
    <>
      <M2MClientCombobox
        id="auth0-client"
        value="existing-id"
        onChange={onChange}
        orgSlug="acme"
        dict={DICT}
      />
      <button type="button">Outside</button>
    </>
  );
  return { onChange, user: userEvent.setup() };
}

describe("M2MClientCombobox", () => {
  it("keeps the stored client id visible when the field opens", async () => {
    const { user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);

    expect(input).toHaveValue("existing-id");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(mockedUseM2MClients).toHaveBeenLastCalledWith(
      "acme",
      "existing-id",
      true
    );
  });

  it("exposes listbox semantics and selects with the Arrow keys and Enter", async () => {
    const { onChange, user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);

    expect(screen.getByRole("listbox")).toHaveAttribute(
      "id",
      "auth0-client-listbox"
    );
    expect(screen.getAllByRole("option")).toHaveLength(2);

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("other-id");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("preserves option tabbing and closes after focus leaves the field", async () => {
    const { user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    await user.tab();
    expect(screen.getAllByRole("option")[0]).toHaveFocus();

    await user.tab();
    expect(screen.getAllByRole("option")[1]).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape without changing the stored value", async () => {
    const { onChange, user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    await user.keyboard("{Escape}");

    expect(input).toHaveValue("existing-id");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });
});
