import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvironmentSelect } from "./environment-select";

const DICT = {
  environments: {
    DEVELOPMENT: "Development",
    QA: "QA",
    PRODUCTION: "Production",
  },
  modal: {
    environmentPlaceholder: "Select or create an environment",
    environmentCreate: 'Create "{name}"',
    environmentEmpty: "Type a name to create an environment",
  },
};

const OPTIONS = ["DEVELOPMENT", "QA", "PRODUCTION"];

function setup(value = "DEVELOPMENT", options = OPTIONS) {
  const onChange = vi.fn();
  render(
    <EnvironmentSelect
      id="env"
      value={value}
      onChange={onChange}
      options={options}
      dict={DICT}
    />
  );
  return { onChange, user: userEvent.setup() };
}

describe("EnvironmentSelect", () => {
  it("shows the translated label of the current selection when closed", () => {
    setup("DEVELOPMENT");

    expect(screen.getByRole("combobox")).toHaveValue("Development");
  });

  it("lists every known environment on focus", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: /Production/ })).toBeVisible();
  });

  it("filters the list as the user types", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("prod");

    // A partial match keeps Production in the list and still offers to create
    // the literal text typed — "prod" is not itself an existing environment.
    expect(screen.getByRole("option", { name: /^Production/ })).toBeVisible();
    expect(screen.queryByRole("option", { name: /Development/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /^QA/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Create "prod"/ })).toBeVisible();
  });

  it("selects an existing environment", async () => {
    const { user, onChange } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /QA/ }));

    expect(onChange).toHaveBeenCalledWith("QA");
  });

  it("offers to create an environment that does not exist yet", async () => {
    const { user, onChange } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("staging");

    const createRow = screen.getByRole("option", { name: /Create "staging"/ });
    await user.click(createRow);

    expect(onChange).toHaveBeenCalledWith("staging");
  });

  it("reuses an existing environment instead of creating a case variant", async () => {
    const { user, onChange } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("qa");

    // No create row: "qa" already exists as "QA".
    expect(screen.queryByRole("option", { name: /Create/ })).toBeNull();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("QA");
  });

  it("creates from the keyboard without submitting the form", async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onChange = vi.fn();
    render(
      <form onSubmit={submit}>
        <EnvironmentSelect
          id="env"
          value="QA"
          onChange={onChange}
          options={OPTIONS}
          dict={DICT}
        />
      </form>
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("sandbox{Enter}");

    expect(onChange).toHaveBeenCalledWith("sandbox");
    expect(submit).not.toHaveBeenCalled();
  });

  it("trims and collapses whitespace in a created name", async () => {
    const { user, onChange } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("  pre   prod  {Enter}");

    expect(onChange).toHaveBeenCalledWith("pre prod");
  });
});
