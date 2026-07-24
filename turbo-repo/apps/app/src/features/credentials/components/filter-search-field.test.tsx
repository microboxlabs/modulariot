import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterSearchField } from "./filter-search-field";

function setup(value = "") {
  const onChange = vi.fn();
  render(
    <FilterSearchField
      id="search"
      value={value}
      onChange={onChange}
      placeholder="Search credentials"
    />
  );
  return { onChange, user: userEvent.setup() };
}

describe("FilterSearchField", () => {
  it("reports what the user types", async () => {
    const { user, onChange } = setup();

    await user.type(screen.getByRole("searchbox"), "qa");

    expect(onChange).toHaveBeenCalledWith("q");
  });

  it("offers no clear affordance while empty", () => {
    setup("");

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("clears the term from the inline button", async () => {
    const { user, onChange } = setup("entra");

    await user.click(screen.getByRole("button"));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("switches to the active badge style once it carries a term", () => {
    const { container } = render(
      <FilterSearchField
        id="search"
        value="entra"
        onChange={() => {}}
        placeholder="Search credentials"
      />
    );

    // Same active token the filter badges use, so the row stays one family.
    expect(container.firstElementChild).toHaveClass("bg-blue-50");
  });
});
