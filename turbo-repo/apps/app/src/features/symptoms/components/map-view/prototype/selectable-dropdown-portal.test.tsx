import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "en" }) }));
vi.mock("@/features/settings-admin/selectables/store", () => ({
  useSelectables: () => ({
    selectables: [
      {
        key: "reasons",
        name: { en: "Reasons" },
        mode: "SINGLE",
        options: [
          { value: "first", label: { en: "First reason" } },
          { value: "second", label: { en: "Second reason" } },
        ],
      },
    ],
  }),
}));
vi.mock("@/features/settings-admin/selectables/field-bindings", () => ({
  useFieldSelectableBinding: () => ["reasons", vi.fn()],
}));
import { SelectableDropdown } from "./prototype-form-kit";

function renderInClippingCard(props: {
  value?: string;
  onSelect?: () => void;
  onClear?: () => void;
}) {
  const onSelect = props.onSelect ?? vi.fn();
  render(
    <section data-testid="card" style={{ overflowY: "auto", height: 40 }}>
      <SelectableDropdown
        fieldKey="reasons"
        dict={{}}
        value={props.value ?? ""}
        onSelect={onSelect}
        placeholder="Pick a reason"
        {...(props.onClear
          ? { clearLabel: "Clear reason", onClear: props.onClear }
          : {})}
      />
    </section>
  );
  return { onSelect };
}

async function openMenu(shown: string) {
  const trigger = screen.getByRole("combobox");
  expect(trigger).toHaveTextContent(shown);
  await act(async () => {
    fireEvent.click(trigger);
  });
}

describe("SelectableDropdown single-pick menu", () => {
  it("renders the menu outside the clipping card", async () => {
    renderInClippingCard({});
    await openMenu("Pick a reason");
    const listbox = screen.getByRole("listbox");
    expect(screen.getByTestId("card").contains(listbox)).toBe(false);
    expect(document.body.contains(listbox)).toBe(true);
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("selects an option and closes the menu", async () => {
    const { onSelect } = renderInClippingCard({});
    await openMenu("Pick a reason");
    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: "Second reason" }));
    });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "second", name: "Second reason" })
    );
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("marks the current value and offers the clear item", async () => {
    const onClear = vi.fn();
    renderInClippingCard({ value: "first", onClear });
    await openMenu("First reason");
    expect(
      screen.getByRole("option", { name: "First reason" })
    ).toHaveAttribute("aria-selected", "true");
    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: "Clear reason" }));
    });
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("closes on Escape and on a click outside", async () => {
    renderInClippingCard({});
    await openMenu("Pick a reason");
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
    });
    expect(screen.queryByRole("listbox")).toBeNull();

    await openMenu("Pick a reason");
    await act(async () => {
      fireEvent.pointerDown(document.body);
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens from the keyboard and moves focus with the arrow keys", async () => {
    const { onSelect } = renderInClippingCard({});
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await act(async () => {
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
    });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });
    expect(document.activeElement).toBe(
      screen.getByRole("option", { name: "First reason" })
    );
    await act(async () => {
      fireEvent.keyDown(document.activeElement as Element, {
        key: "ArrowDown",
      });
    });
    const second = screen.getByRole("option", { name: "Second reason" });
    expect(document.activeElement).toBe(second);
    await act(async () => {
      fireEvent.click(second);
    });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "second" })
    );
  });
});
