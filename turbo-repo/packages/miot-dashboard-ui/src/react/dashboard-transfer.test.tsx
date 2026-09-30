// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { DashboardTransfer } from "./dashboard-transfer";
import { useDashboardState } from "./use-dashboard-state";
import { makeDashboardStorage } from "./test-fixtures";
afterEach(cleanup);
const labels = {
  export: "Export",
  file: "File",
  json: "JSON",
  replace: "Replace draft",
  hint: "Save separately",
  tooLarge: "Too large",
  invalid: "Invalid",
  success: "Applied",
};
it("keeps export available but gates imports and checks UTF-8 byte size", () => {
  const onExport = vi.fn(),
    onImport = vi.fn(() => ({ success: true }));
  const view = render(
    <DashboardTransfer
      labels={labels}
      onExport={onExport}
      onImport={onImport}
      maxImportBytes={4}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(onExport).toHaveBeenCalledOnce();
  expect(screen.queryByRole("textbox")).toBeNull();
  view.rerender(
    <DashboardTransfer
      labels={labels}
      onExport={onExport}
      onImport={onImport}
      maxImportBytes={4}
      editable
    />,
  );
  fireEvent.change(screen.getByLabelText("JSON"), { target: { value: "ééé" } });
  fireEvent.click(screen.getByRole("button", { name: "Replace draft" }));
  expect(screen.getByRole("alert").textContent).toBe("Too large");
  expect(onImport).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("JSON"), { target: { value: "{}" } });
  fireEvent.click(screen.getByRole("button", { name: "Replace draft" }));
  expect(onImport).toHaveBeenCalledWith("{}");
  expect(screen.getByRole("status").textContent).toBe("Applied");
});
it("does not read oversized files", () => {
  const file = new File(["too big"], "large.json"),
    text = vi.fn();
  Object.defineProperty(file, "text", { value: text });
  render(
    <DashboardTransfer
      labels={labels}
      onExport={vi.fn()}
      onImport={vi.fn()}
      maxImportBytes={4}
      editable
    />,
  );
  fireEvent.change(screen.getByLabelText("File"), {
    target: { files: [file] },
  });
  expect(text).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toBe("Too large");
});
it("loads a file into a draft without importing automatically", async () => {
  const file = new File(["{}"], "config.json");
  Object.defineProperty(file, "text", { value: async () => "{}" });
  const onImport = vi.fn();
  render(
    <DashboardTransfer
      labels={labels}
      onExport={vi.fn()}
      onImport={onImport}
      editable
    />,
  );
  fireEvent.change(screen.getByLabelText("File"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect((screen.getByLabelText("JSON") as HTMLTextAreaElement).value).toBe(
      "{}",
    ),
  );
  expect(onImport).not.toHaveBeenCalled();
});
it("isolates an undoable import from edits immediately before and after it", () => {
  const initial = makeDashboardStorage({ name: "Original" });
  const view = renderHook(() => {
    const [config, setConfig] = useState(initial);
    return useDashboardState({
      config,
      onChange: setConfig,
      isLoaded: true,
      readOnly: false,
    });
  });
  act(() => view.result.current.setDashboardName("Before import"));
  act(() => {
    expect(
      view.result.current.importDashboard(
        JSON.stringify({ ...initial, name: "Imported" }),
        { undoable: true },
      ).success,
    ).toBe(true);
  });
  act(() => view.result.current.setDashboardName("After import"));
  act(() => view.result.current.undo());
  expect(view.result.current.dashboardName).toBe("Imported");
  act(() => view.result.current.undo());
  expect(view.result.current.dashboardName).toBe("Before import");
  act(() => view.result.current.redo());
  expect(view.result.current.dashboardName).toBe("Imported");
});
