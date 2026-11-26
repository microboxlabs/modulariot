import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TagPicker, {
  matchingExtras,
  normalizeTag,
  type TagOption,
  type TagPickerProps,
} from "./tag-picker";

const labels = {
  placeholder: "Search or create a tag",
  create: (name: string) => `Create "${name}"`,
  remove: (name: string) => `Remove ${name}`,
  rename: "Rename",
  renameOf: (name: string) => `Rename ${name}`,
  deleteOf: (name: string) => `Delete ${name}`,
  save: "Save",
  cancel: "Cancel",
  selectedTitle: "Tags",
  empty: "No tags",
};

/** A page that keeps its own list and selection, as a real one does. */
function Page(
  props: Readonly<Partial<TagPickerProps> & { initialOptions?: TagOption[] }>
) {
  const [options, setOptions] = useState<TagOption[]>(
    props.initialOptions ?? []
  );
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <TagPicker
      options={options}
      selectedIds={selected}
      onChange={setSelected}
      onCreate={(name) => {
        const tag = { id: `t-${name}`, name: name.trim() };
        setOptions((current) => [...current, tag]);
        return tag;
      }}
      labels={labels}
      {...props}
    />
  );
}

const field = () => screen.getByPlaceholderText("Search or create a tag");

describe("normalizeTag", () => {
  it("ignores case, accents and repeated spaces", () => {
    expect(normalizeTag("  Planta  PEÑÓN ")).toBe("planta penon");
  });
});

describe("matchingExtras", () => {
  const extras = [{ label: "Bodega Sur" }, { label: "Sur" }];
  it("puts the exact match first and leaves out existing tags", () => {
    expect(matchingExtras(extras, [], "sur", 8).map((e) => e.label)).toEqual([
      "Sur",
      "Bodega Sur",
    ]);
    expect(
      matchingExtras(extras, [{ id: "1", name: "SUR" }], "sur", 8)
    ).toEqual([{ label: "Bodega Sur" }]);
    expect(matchingExtras(extras, [], " ", 8)).toEqual([]);
  });
});

describe("TagPicker", () => {
  it("draws an icon at the start of the field and makes room for it", () => {
    const { container } = render(
      <Page icon={(props) => <svg data-testid="field-icon" {...props} />} />
    );
    expect(screen.getByTestId("field-icon")).toBeInTheDocument();
    expect(field()).toHaveClass("pl-10");
    expect(container.querySelector("input")).toBe(field());
  });

  it("has no icon unless asked", () => {
    render(<Page />);
    expect(field()).not.toHaveClass("pl-10");
  });

  it("creates a tag on Enter and lists it on the record", async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("No tags")).toBeInTheDocument();
    await user.type(field(), "night{Enter}");
    expect(
      screen.getByRole("button", { name: "Remove night" })
    ).toBeInTheDocument();
    expect(field()).toHaveValue("");
  });

  it("picks an existing tag instead of creating a twin", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <Page initialOptions={[{ id: "a", name: "Peñón" }]} onCreate={onCreate} />
    );
    await user.type(field(), "PENON");
    expect(screen.queryByRole("button", { name: /^Create/ })).toBeNull();
    await user.keyboard("{Enter}");
    expect(onCreate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Remove Peñón" })
    ).toBeInTheDocument();
  });

  it("offers rename and delete only when the page allows them", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Page initialOptions={[{ id: "a", name: "north" }]} />
    );
    await user.type(field(), "nor");
    expect(screen.queryByRole("button", { name: "Rename north" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete north" })).toBeNull();
    unmount();

    const onRename = vi.fn(() => true);
    const onDelete = vi.fn();
    render(
      <Page
        initialOptions={[{ id: "a", name: "north" }]}
        onRename={onRename}
        onDelete={onDelete}
      />
    );
    await user.type(field(), "nor");
    await user.click(screen.getByRole("button", { name: "Rename north" }));
    const box = screen.getByRole("textbox", { name: "Rename" });
    await user.clear(box);
    await user.type(box, "south{Enter}");
    expect(onRename).toHaveBeenCalledWith("a", "south");
    await user.click(screen.getByRole("button", { name: "Delete north" }));
    expect(onDelete).toHaveBeenCalledWith("a");
  });

  it("creates an extra as the extra writes it, even beyond the ones listed", async () => {
    const user = userEvent.setup();
    const extras = [
      ...Array.from({ length: 3 }, (_, i) => ({ label: `Planta ${i}` })),
      { label: "Planta" },
    ];
    render(<Page extras={extras} maxExtras={2} />);
    await user.type(field(), "PLANTA{Enter}");
    expect(
      screen.getByRole("button", { name: "Remove Planta" })
    ).toBeInTheDocument();
  });

  it("closes the suggestions on Escape or a click elsewhere", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const create = () => screen.queryByRole("button", { name: 'Create "ab"' });
    await user.type(field(), "ab");
    expect(create()).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(create()).toBeNull();
    expect(field()).toHaveValue("ab");

    await user.click(field());
    expect(create()).toBeInTheDocument();
    await user.click(document.body);
    expect(create()).toBeNull();
  });

  it("stops adding at the limit", async () => {
    const user = userEvent.setup();
    render(<Page max={1} />);
    await user.type(field(), "one{Enter}two");
    expect(screen.getByRole("button", { name: 'Create "two"' })).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: "Remove two" })).toBeNull();
  });

  it("respects the limit for existing tags and still lets selected tags be removed", async () => {
    const user = userEvent.setup();
    render(
      <Page
        max={1}
        initialOptions={[
          { id: "a", name: "north" },
          { id: "b", name: "south" },
        ]}
      />
    );
    await user.type(field(), "north{Enter}south");
    const south = screen.getByRole("button", { name: "south" });
    expect(south).toBeDisabled();
    await user.click(south);
    expect(screen.queryByRole("button", { name: "Remove south" })).toBeNull();

    await user.clear(field());
    await user.type(field(), "north");
    const north = screen.getByRole("button", { name: "north", pressed: true });
    expect(north).toBeEnabled();
    await user.click(north);
    expect(screen.queryByRole("button", { name: "Remove north" })).toBeNull();

    await user.clear(field());
    await user.type(field(), "south");
    await user.click(screen.getByRole("button", { name: "south" }));
    expect(
      screen.getByRole("button", { name: "Remove south" })
    ).toBeInTheDocument();
  });
});
