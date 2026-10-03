import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, expect, it, vi } from "vitest";
import { PostgrestFunctionsModal } from "./postgrest-functions-modal";
import type { IntegrationConnection } from "../integration-config.types";

const api = vi.hoisted(() => ({
  fetchPostgrestFunctions: vi.fn(),
  importPostgrestFunctions: vi.fn(),
}));
vi.mock("../integration-config-data-service", () => api);
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string, _dict: unknown, params?: Record<string, string>) =>
    params ? `${key}:${Object.values(params).join(",")}` : key,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const connection: IntegrationConnection = {
  id: "c1",
  name: "Data",
  providerType: "POSTGREST",
  baseUrl: "https://data.example",
  credentialProfileId: "p1",
  status: "ACTIVE",
  lastTestedAt: null,
  lastTestResult: true,
  templateId: null,
  metadata: {},
};

beforeEach(() => {
  api.fetchPostgrestFunctions.mockReset();
  api.importPostgrestFunctions.mockReset();
  api.fetchPostgrestFunctions.mockResolvedValue([
    {
      name: "fn_summary",
      path: "/rpc/fn_summary",
      description: "Fleet summary",
      parameters: [{ name: "p_client", type: "string", format: "text", required: false }],
      operationId: null,
    },
    {
      name: "fn_done",
      path: "/rpc/fn_done",
      description: null,
      parameters: [],
      operationId: "op-1",
    },
  ]);
  api.importPostgrestFunctions.mockResolvedValue({ created: [{ id: "op-2", name: "fn_summary" }], existing: [] });
});

function show() {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <PostgrestFunctionsModal orgSlug="acme" connection={connection} onClose={vi.fn()} dict={{}} />
    </SWRConfig>
  );
}

it("imports the selected functions with a pinned parameter", async () => {
  show();
  fireEvent.click(await screen.findByLabelText("fn_summary"));
  expect(screen.getByLabelText("fn_done")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "postgrest.addPin" }));
  fireEvent.change(screen.getByLabelText("postgrest.pinParameter"), { target: { value: "p_client" } });
  fireEvent.change(screen.getByLabelText("postgrest.pinValue"), { target: { value: "client-1" } });
  fireEvent.click(screen.getByRole("button", { name: "postgrest.import:1" }));
  await waitFor(() =>
    expect(api.importPostgrestFunctions).toHaveBeenCalledWith("acme", "c1", {
      functions: [{ name: "fn_summary", pinned: { p_client: "client-1" } }],
    })
  );
  await waitFor(() => expect(api.fetchPostgrestFunctions).toHaveBeenCalledTimes(2));
});

it("shows why the functions could not be read", async () => {
  api.fetchPostgrestFunctions.mockRejectedValue(new Error("PostgREST answered HTTP 401"));
  show();
  expect(await screen.findByText("PostgREST answered HTTP 401")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "postgrest.import:0" })).toBeDisabled();
});
