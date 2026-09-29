import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsSelectField } from "./settings-fields";

vi.mock("../../context/dashboard-context", () => ({
  useOptionalDashboard: () => ({
    hostAccess: { canEdit: true, canManagePermissions: false },
    dictionary: { dashboard: { requiresMigration: "requires migration" } },
  }),
}));
afterEach(cleanup);

describe("host data source settings", () => {
  it.each(["pgrest", "dynamic"])(
    "represents an existing %s source without silently changing it",
    (value) => {
      const onChange = vi.fn();
      render(
        <SettingsSelectField
          id="source"
          label="Source"
          value={value}
          onChange={onChange}
          options={[
            { value: "static", label: "Static" },
            { value: "planner", label: "Saved query" },
            { value: "pgrest", label: "PGREST" },
            { value: "dynamic", label: "Direct URL" },
          ]}
        />
      );
      const selected = screen.getByRole("option", {
        name: /requires migration/,
      }) as HTMLOptionElement;
      expect(selected.selected).toBe(true);
      expect(selected.disabled).toBe(true);
      expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
        value
      );
      expect(screen.getAllByRole("option")).toHaveLength(3);
      expect(onChange).not.toHaveBeenCalled();
    }
  );
});
