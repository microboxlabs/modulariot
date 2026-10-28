import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationConnection } from "../integration-config.types";
import { BigQueryQueriesModal } from "./bigquery-queries-modal";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const connection: IntegrationConnection = {
  id: "c1",
  name: "Costos",
  providerType: "CUSTOM_HTTP",
  baseUrl: "https://bigquery.googleapis.com",
  credentialProfileId: "cred-1",
  status: "ACTIVE",
  lastTestedAt: null,
  lastTestResult: null,
  templateId: null,
  metadata: {},
};

const dict = {
  common: { cancel: "Cancel", delete: "Delete" },
  list: { loading: "Loading" },
  bigquery: {
    title: "Queries of {name}",
    empty: "No queries",
    add: "Add query",
    save: "Save query",
    saved: "Saved",
    name: "Name",
    project: "Project",
    location: "Location",
    megabytes: "Maximum read (MB)",
    sql: "SQL",
    parameters: "Parameters",
    parameterName: "Parameter name",
    parameterType: "Type",
    addParameter: "Add parameter",
    errors: { sql: "Enter the SQL." },
  },
};

const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockImplementation(async (_input, init) =>
    init?.method === "POST"
      ? Response.json({ id: "q1" }, { status: 201 })
      : Response.json([])
  );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function show() {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <BigQueryQueriesModal
        orgSlug="demo"
        connection={connection}
        defaultProjectId="acme-analytics"
        onClose={vi.fn()}
        dict={dict}
      />
    </SWRConfig>
  );
}

describe("BigQueryQueriesModal", () => {
  it("saves a query as a BigQuery operation on the connection", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Add query" }));
    expect(screen.getByLabelText("Project")).toHaveValue("acme-analytics");
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Costo por servicio" },
    });
    fireEvent.change(screen.getByLabelText("SQL"), {
      target: { value: "SELECT 1 AS n WHERE @days > 0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add parameter" }));
    fireEvent.change(screen.getByLabelText("Parameter name"), {
      target: { value: "days" },
    });
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "INT64" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save query" }));

    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([, init]) => init?.method === "POST")
      ).toBe(true)
    );
    const [url, init] = fetcher.mock.calls.find(
      ([, call]) => call?.method === "POST"
    )!;
    expect(url).toBe(
      "/app/api/admin/orgs/demo/integrations/connections/c1/operations"
    );
    const body = JSON.parse(String(init?.body));
    expect(body.method).toBe("POST");
    expect(body.requestSchema.required).toEqual(["days"]);
    expect(body.requestSchema["x-dashboard"]).toMatchObject({
      kind: "BIGQUERY",
      projectId: "acme-analytics",
      location: "US",
      maximumBytesBilled: "500000000",
      parameterTypes: { days: "INT64" },
    });
  });

  it("says what is missing instead of saving", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Add query" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Sin SQL" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save query" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter the SQL."
    );
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false
    );
  });

  it("edits parameters independently when added in the same clock tick", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Add query" }));
    vi.spyOn(Date, "now").mockReturnValue(42);
    const add = screen.getByRole("button", { name: "Add parameter" });
    fireEvent.click(add);
    fireEvent.click(add);
    const names = screen.getAllByLabelText("Parameter name");
    fireEvent.change(names[0]!, { target: { value: "first" } });
    fireEvent.change(names[1]!, { target: { value: "second" } });
    expect(names[0]).toHaveValue("first");
    expect(names[1]).toHaveValue("second");
  });

  it("protects the draft against edits while its save is pending", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Add query" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Demo query" },
    });
    fireEvent.change(screen.getByLabelText("SQL"), {
      target: { value: "SELECT 1" },
    });
    let resolve!: (response: Response) => void;
    fetcher.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Save query" }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([, init]) => init?.method === "POST")
      ).toBe(true)
    );
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("SQL")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add parameter" })
    ).toBeDisabled();
    await act(async () =>
      resolve(Response.json({ id: "demo-query" }, { status: 201 }))
    );
    expect(
      await screen.findByRole("button", { name: "Add query" })
    ).toBeEnabled();
  });
});
