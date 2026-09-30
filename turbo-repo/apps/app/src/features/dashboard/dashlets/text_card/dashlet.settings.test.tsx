import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import dictionary from "@/lang/es.json";
import { DashletSettings } from "./dashlet.settings";
import { defaultConfig } from "./dashlet";
vi.mock("../common/use-active-providers", () => ({
  useActiveProviders: () => [],
}));
vi.mock("../common/settings-shell", () => ({
  buildStandardTabs: (_dictionary: object, visualization: ReactNode) => [
    { content: visualization },
  ],
  SettingsShell: ({
    tabs,
    onSave,
    onClose,
  }: Readonly<{
    tabs: { content: ReactNode }[];
    onSave: () => void;
    onClose: () => void;
  }>) => (
    <>
      {tabs[0].content}
      <button onClick={onSave}>Apply</button>
      <button onClick={onClose}>Cancel</button>
    </>
  ),
}));
afterEach(cleanup);
it("applies shared appearance fields while preserving the saved-query binding", () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <DashletSettings
      isOpen
      onSave={onSave}
      onClose={onClose}
      dictionary={dictionary}
      config={{
        ...defaultConfig,
        dataMode: "planner",
        plannerVariableName: "costs",
        dataSourceId: "connection",
        dataProvider: [{ key: "unit", value: "USD" }],
      }}
    />
  );
  fireEvent.change(screen.getByLabelText("Texto"), {
    target: { value: "Cost {{cost}}" },
  });
  fireEvent.change(screen.getByLabelText("Alineación"), {
    target: { value: "right" },
  });
  fireEvent.click(screen.getByLabelText("Cursiva"));
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Apply"));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      text: "Cost {{cost}}",
      align: "right",
      italic: false,
      dataMode: "planner",
      plannerVariableName: "costs",
      dataSourceId: "connection",
      dataProvider: [{ key: "unit", value: "USD" }],
    })
  );
  expect(onClose).toHaveBeenCalledOnce();
});
it("keeps an appearance draft unsaved when the host cancels", () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <DashletSettings
      isOpen
      onSave={onSave}
      onClose={onClose}
      dictionary={dictionary}
      config={defaultConfig}
    />
  );
  fireEvent.change(screen.getByLabelText("Texto"), {
    target: { value: "Unsaved draft" },
  });
  fireEvent.click(screen.getByText("Cancel"));
  expect(onSave).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});
