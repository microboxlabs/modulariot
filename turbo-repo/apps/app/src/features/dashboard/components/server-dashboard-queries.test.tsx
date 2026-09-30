import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ServerDashboardQueries } from "./server-dashboard-queries";
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key.split(".").at(-1),
}));
const { setQueries } = vi.hoisted(() => ({ setQueries: vi.fn(() => true) }));
vi.mock("../context/dashboard-context", () => ({
  useDashboard: () => ({ queries: [], setQueries }),
}));
function client() {
  return {
    key: (slug?: string) => `/dashboards/${slug}`,
    queryCatalog: vi.fn().mockResolvedValue([]),
  };
}
it("loads discovery only when an editor opens the manager", async () => {
  const api = client();
  const { rerender } = render(
    <ServerDashboardQueries
      client={api}
      slug="costs"
      sessionKey="one"
      editable={false}
      dictionary={{}}
    />
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(api.queryCatalog).not.toHaveBeenCalled();
  rerender(
    <ServerDashboardQueries
      client={api}
      slug="costs"
      sessionKey="one"
      editable
      dictionary={{}}
    />
  );
  expect(api.queryCatalog).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "title" }));
  expect(await screen.findByRole("button", { name: "add" })).toBeTruthy();
  expect(api.queryCatalog).toHaveBeenCalledWith(
    "costs",
    expect.any(AbortSignal)
  );
});
it("keeps authoring unavailable when the catalog fails", async () => {
  const api = client();
  api.queryCatalog.mockRejectedValue(new Error("unavailable"));
  render(
    <ServerDashboardQueries
      client={api}
      slug="costs"
      sessionKey="one"
      editable
      dictionary={{}}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "title" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("catalogError");
  expect(screen.queryByRole("button", { name: "add" })).toBeNull();
});

it("applies an approved definition through the dashboard document draft", async () => {
  const api = client();
  api.queryCatalog.mockResolvedValue([
    {
      id: "billing",
      label: "Billing",
      operations: [{ id: "costs", label: "Costs" }],
    },
  ]);
  render(
    <ServerDashboardQueries
      client={api}
      slug="costs"
      sessionKey="one"
      editable
      dictionary={{}}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "title" }));
  fireEvent.click(await screen.findByRole("button", { name: "add" }));
  fireEvent.change(screen.getByLabelText("name"), {
    target: { value: "monthly_costs" },
  });
  fireEvent.change(screen.getByLabelText("connection"), {
    target: { value: "billing" },
  });
  fireEvent.change(screen.getByLabelText("operation"), {
    target: { value: "costs" },
  });
  fireEvent.click(screen.getByRole("button", { name: "apply" }));
  expect(setQueries).toHaveBeenCalledWith([
    expect.objectContaining({
      variableName: "monthly_costs",
      connectionId: "billing",
      operationId: "costs",
      parameters: {},
    }),
  ]);
});
