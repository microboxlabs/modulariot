// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { DashboardGeneralSettings } from "./dashboard-general-settings";
import { useDashboardState } from "./use-dashboard-state";
import { makeDashboardStorage } from "./test-fixtures";
afterEach(cleanup);
const labels = {
  name: "Title",
  refresh: "Refresh",
  order: "Order",
  apply: "Apply",
  invalid: "Invalid",
  rejected: "Rejected",
  intervals: {
    0: "Off",
    10: "10 seconds",
    30: "30 seconds",
    60: "1 minute",
    300: "5 minutes",
  },
};
it("keeps invalid or rejected drafts and immediately disables revoked editing", () => {
  const onApply = vi.fn(() => false);
  const value = { name: "Costs", refreshInterval: 0 as const };
  const view = render(
    <DashboardGeneralSettings
      value={value}
      labels={labels}
      onApply={onApply}
      editable
    />,
  );
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(screen.getByRole("alert").textContent).toBe("Invalid");
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: " Monthly " },
  });
  fireEvent.change(screen.getByLabelText("Refresh"), {
    target: { value: "60" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(onApply).toHaveBeenCalledWith({
    name: "Monthly",
    refreshInterval: 60,
    order: undefined,
  });
  expect(screen.getByRole("alert").textContent).toBe("Rejected");
  view.rerender(
    <DashboardGeneralSettings
      value={value}
      labels={labels}
      onApply={onApply}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(onApply).toHaveBeenCalledTimes(1);
});
it("applies one undoable patch, preserves other settings, and rejects unauthorized/invalid changes", () => {
  const original = makeDashboardStorage({
    name: "Original",
    order: 3,
    refreshInterval: 10,
    allowedGroups: ["retained"],
  });
  const view = renderHook(
    ({ readOnly }) => {
      const [config, onChange] = useState(original);
      return {
        config,
        state: useDashboardState({
          config,
          onChange,
          isLoaded: true,
          readOnly,
        }),
      };
    },
    { initialProps: { readOnly: false } },
  );
  act(() => {
    expect(
      view.result.current.state.setGeneralSettings({
        name: "New",
        refreshInterval: 60,
      }),
    ).toBe(true);
  });
  expect(view.result.current.config).toMatchObject({
    name: "New",
    refreshInterval: 60,
    allowedGroups: ["retained"],
  });
  expect(view.result.current.config.order).toBeUndefined();
  act(() => view.result.current.state.undo());
  expect(view.result.current.config).toEqual(original);
  act(() => {
    expect(
      view.result.current.state.setGeneralSettings({
        name: "",
        refreshInterval: 0,
      }),
    ).toBe(false);
  });
  view.rerender({ readOnly: true });
  act(() => {
    expect(
      view.result.current.state.setGeneralSettings({
        name: "Denied",
        refreshInterval: 0,
      }),
    ).toBe(false);
  });
  expect(view.result.current.config).toEqual(original);
});
