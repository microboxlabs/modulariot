import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import { TemplatePickerModal } from "./template-picker-modal";

const dict = en.pages.integrationConnections;

function renderPicker(onSelectManagedGeocoding?: () => void) {
  render(
    <TemplatePickerModal
      show
      templates={[]}
      onClose={vi.fn()}
      onSelect={vi.fn()}
      onSelectNative={vi.fn()}
      onSelectManagedGeocoding={onSelectManagedGeocoding}
      dict={dict}
    />
  );
}

describe("TemplatePickerModal", () => {
  it("offers the platform's geocoding only when a handler is given", () => {
    renderPicker();

    expect(screen.queryByText(dict.picker.managedGeocoding)).toBeNull();
  });

  it("connects the platform's geocoding", () => {
    const onSelect = vi.fn();
    renderPicker(onSelect);

    fireEvent.click(screen.getByText(dict.picker.managedGeocoding));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
