// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {
  QueryPlan,
  QueryPreview,
  SourceSchema,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import { QueryAuthoringError, type QueryAuthoringClient } from "./client";
import type { SqlEditorHandle, SqlEditorProps } from "./sql-editor";
import { QueryWorkbench } from "./query-workbench";

const inserted: string[] = [];
vi.mock("./sql-editor", () => ({
  SqlEditor: forwardRef<SqlEditorHandle, SqlEditorProps>(function Editor(
    { value, onChange, ariaLabel, readOnly },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      insert: (text: string) => inserted.push(text),
      focus: () => {},
    }));
    return (
      <textarea
        aria-label={ariaLabel}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }),
}));

afterEach(cleanup);
beforeEach(() => {
  inserted.length = 0;
});

const plan: QueryPlan = {
  id: "daily",
  sourceId: "warehouse",
  name: "Daily trips",
  projectId: "analytics-prod",
  location: "US",
  sql: "SELECT day FROM `fleet.daily`",
  maximumBytesBilled: 100_000_000,
  parameters: [],
  revision: "r1",
  updatedAt: "2026-10-27T00:00:00Z",
};

const preview: QueryPreview = {
  ok: true,
  columns: [{ name: "day", type: "DATE" }],
  rows: [{ day: "2026-10-01" }, { day: null }],
  totalRows: 2,
  truncated: false,
  totalBytesProcessed: 42_000_000,
  cacheHit: false,
  durationMs: 812,
  warnings: [],
};

function client(overrides: Partial<QueryAuthoringClient> = {}) {
  return {
    listSources: vi.fn(async () => [
      {
        id: "warehouse",
        label: "Warehouse",
        kind: "BIGQUERY" as const,
        defaultProjectId: "analytics-prod",
      },
    ]),
    schema: vi.fn(async () => ({
      projectId: "analytics-prod",
      truncated: false,
      datasets: [
        {
          name: "fleet",
          location: "US",
          tables: [
            {
              name: "daily",
              type: "TABLE" as const,
              columns: [{ name: "day", type: "DATE" }],
            },
          ],
        },
      ],
    })),
    listPlans: vi.fn(async () => [plan]),
    createPlan: vi.fn(async (_source, draft) => ({
      ...plan,
      ...draft,
      id: "new-plan",
      revision: "n1",
    })),
    updatePlan: vi.fn(async (_source, _plan, draft) => ({
      ...plan,
      ...draft,
      revision: "r2",
    })),
    removePlan: vi.fn(async () => {}),
    estimate: vi.fn(async () => ({
      ok: true,
      statementType: "SELECT",
      totalBytesProcessed: 42_000_000,
    })),
    preview: vi.fn(async () => preview),
    ...overrides,
  } satisfies QueryAuthoringClient;
}

async function openDaily(api: QueryAuthoringClient, canWrite = true) {
  render(<QueryWorkbench client={api} canWrite={canWrite} locale="en" />);
  fireEvent.click(await screen.findByRole("button", { name: "Daily trips" }));
}

it("estimates, runs and shows the rows of a saved query", async () => {
  const api = client();
  await openDaily(api);
  expect(
    await screen.findByText("Will read 42 MB", {}, { timeout: 2000 }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Run/ }));
  expect(await screen.findByText("2026-10-01")).toBeTruthy();
  expect(screen.getByText("2 rows · 42 MB read · 812 ms")).toBeTruthy();
  expect(api.preview).toHaveBeenCalledWith(
    "warehouse",
    expect.objectContaining({ sql: plan.sql }),
    expect.any(AbortSignal),
  );
});

it("marks unsaved changes, saves with the revision read and discards", async () => {
  const api = client();
  await openDaily(api);
  const save = screen.getByRole("button", { name: "Save" });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("SQL"), {
    target: { value: "SELECT 1" },
  });
  expect(screen.getByRole("img", { name: "Unsaved changes" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect((screen.getByLabelText("SQL") as HTMLTextAreaElement).value).toBe(
    plan.sql,
  );
  fireEvent.change(screen.getByLabelText("SQL"), {
    target: { value: "SELECT 2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(api.updatePlan).toHaveBeenCalledWith(
      "warehouse",
      plan,
      expect.objectContaining({ sql: "SELECT 2" }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole("img", { name: "Unsaved changes" })).toBeNull(),
  );
});

it("creates a new query in the source's project", async () => {
  const api = client();
  render(<QueryWorkbench client={api} canWrite />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "+ New query" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "+ New query" }));
  fireEvent.change(screen.getByLabelText("SQL"), {
    target: { value: "SELECT 1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(api.createPlan).toHaveBeenCalledWith(
      "warehouse",
      expect.objectContaining({
        name: "New query",
        projectId: "analytics-prod",
        sql: "SELECT 1",
      }),
    ),
  );
});

it("says when someone else saved the query", async () => {
  const api = client({
    updatePlan: vi.fn(async () => {
      throw new QueryAuthoringError(409);
    }),
  });
  await openDaily(api);
  fireEvent.change(screen.getByLabelText("SQL"), {
    target: { value: "SELECT 2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Someone else saved this query. Reload it to see their version.",
  );
});

it("shows BigQuery's error with its line", async () => {
  const api = client({
    estimate: vi.fn(async () => ({
      ok: false,
      problem: {
        message: "Unrecognized name: dya at [1:8]",
        line: 1,
        column: 8,
      },
    })),
  });
  await openDaily(api);
  expect(
    await screen.findByText(
      "Unrecognized name: dya at [1:8] · line 1",
      {},
      { timeout: 2000 },
    ),
  ).toBeTruthy();
});

it("offers to declare the @parameters the SQL uses", async () => {
  await openDaily(client());
  fireEvent.change(screen.getByLabelText("SQL"), {
    target: { value: "SELECT * FROM t WHERE day >= @since" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Declare @since" }));
  expect(
    (screen.getAllByLabelText("Name").at(-1) as HTMLInputElement).value,
  ).toBe("since");
});

it("inserts names from the schema explorer", async () => {
  await openDaily(client());
  await act(() => new Promise((resolve) => setTimeout(resolve, 450)));
  fireEvent.click(
    await screen.findByRole("button", { name: "Show or hide fleet" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Show or hide fleet.daily" }),
  );
  fireEvent.click(screen.getByRole("button", { name: /^day/ }));
  fireEvent.click(screen.getByText("daily"));
  expect(inserted).toEqual(["day", "`fleet.daily`"]);
});

it("hides saving and deleting without write permission", async () => {
  await openDaily(client(), false);
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  expect(screen.getByRole("button", { name: /Run/ })).toBeTruthy();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("preserves a duplicate-name conflict detail instead of telling the author to reload", async () => {
  const api = client({
    updatePlan: vi.fn(async () => {
      throw new QueryAuthoringError(409, "A demo query already has that name");
    }),
  });
  await openDaily(api);
  fireEvent.change(screen.getByLabelText("SQL"), {
    target: { value: "SELECT 2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "A demo query already has that name",
  );
});

it.each(["new", "duplicate"])(
  "keeps a controlled %s draft open when the host echoes a null planId",
  async (action) => {
    const api = client();
    function Controlled() {
      const [id, setId] = useState<string | null>("daily");
      return (
        <QueryWorkbench
          client={api}
          sourceId="warehouse"
          canWrite
          planId={id}
          onPlanChange={setId}
        />
      );
    }
    render(<Controlled />);
    await screen.findByLabelText("SQL");
    fireEvent.click(
      screen.getByRole("button", {
        name: action === "new" ? "+ New query" : "Duplicate",
      }),
    );
    expect(screen.getByLabelText("SQL")).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      action === "new" ? "New query" : "Daily trips (copy)",
    );
  },
);

it("clears completed results when planId changes through external navigation", async () => {
  const next = { ...plan, id: "next", name: "Next demo", sql: "SELECT 9" };
  const api = client({ listPlans: vi.fn(async () => [plan, next]) });
  const view = render(
    <QueryWorkbench
      client={api}
      sourceId="warehouse"
      canWrite
      planId="daily"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Run/ }));
  await screen.findByText("2026-10-01");
  view.rerender(
    <QueryWorkbench client={api} sourceId="warehouse" canWrite planId="next" />,
  );
  expect(screen.queryByText("2026-10-01")).toBeNull();
  expect((screen.getByLabelText("SQL") as HTMLTextAreaElement).value).toBe(
    "SELECT 9",
  );
});

it("aborts and ignores a preview that finishes after external navigation", async () => {
  const pending = deferred<QueryPreview>();
  const next = { ...plan, id: "next", name: "Next demo", sql: "SELECT 9" };
  const run = vi.fn(async () => pending.promise);
  const api = client({
    listPlans: vi.fn(async () => [plan, next]),
    preview: run,
  });
  const view = render(
    <QueryWorkbench
      client={api}
      sourceId="warehouse"
      canWrite
      planId="daily"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Run/ }));
  await waitFor(() => expect(run).toHaveBeenCalledOnce());
  const signal = (
    run.mock.calls[0] as unknown as [string, unknown, AbortSignal]
  )[2];
  view.rerender(
    <QueryWorkbench client={api} sourceId="warehouse" canWrite planId="next" />,
  );
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(preview));
  expect(screen.queryByText("2026-10-01")).toBeNull();
});

it("does not put a source A save into source B or change B's selection", async () => {
  const pending = deferred<QueryPlan>();
  const next = {
    ...plan,
    id: "lake-plan",
    sourceId: "lake",
    name: "Lake demo",
    sql: "SELECT 9",
  };
  const save = vi.fn(async () => pending.promise);
  const api = client({
    listSources: vi.fn(async () => [
      {
        id: "warehouse",
        label: "Warehouse",
        kind: "BIGQUERY" as const,
        defaultProjectId: "analytics-prod",
      },
      {
        id: "lake",
        label: "Lake",
        kind: "BIGQUERY" as const,
        defaultProjectId: "demo-project",
      },
    ]),
    listPlans: vi.fn(async (source) =>
      source === "warehouse" ? [plan] : [next],
    ),
    updatePlan: save,
  });
  await openDaily(api);
  fireEvent.change(screen.getByLabelText("SQL"), {
    target: { value: "SELECT 2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByLabelText("Source"), {
    target: { value: "lake" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Lake demo" }));
  await act(async () =>
    pending.resolve({ ...plan, sql: "SELECT 2", revision: "r2" }),
  );
  expect((screen.getByLabelText("SQL") as HTMLTextAreaElement).value).toBe(
    "SELECT 9",
  );
  expect(screen.queryByRole("button", { name: "Daily trips" })).toBeNull();
});

it("locks SQL and settings for the complete pending save", async () => {
  const pending = deferred<QueryPlan>();
  const save = vi.fn(async () => pending.promise);
  const api = client({ updatePlan: save });
  await openDaily(api);
  fireEvent.change(screen.getByLabelText("SQL"), {
    target: { value: "SELECT 2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("SQL")).toHaveProperty("readOnly", true);
  expect(screen.getByLabelText("Name")).toHaveProperty("disabled", true);
  await act(async () =>
    pending.resolve({ ...plan, sql: "SELECT 2", revision: "r2" }),
  );
});

it("clears a failed preview diagnostic when SQL is edited", async () => {
  const api = client({
    preview: vi.fn(async () => ({
      ...preview,
      ok: false,
      problem: { message: "Old demo error", line: 1 },
    })),
  });
  await openDaily(api);
  fireEvent.click(screen.getByRole("button", { name: /Run/ }));
  await screen.findByText(/Old demo error/);
  fireEvent.change(screen.getByLabelText("SQL"), {
    target: { value: "SELECT 2" },
  });
  expect(screen.queryByText(/Old demo error/)).toBeNull();
});

it.each(["sources", "plans"])(
  "shows an initial %s load failure before a query is open",
  async (step) => {
    const fail = vi.fn(async () => {
      throw new QueryAuthoringError(403, "Demo access denied");
    });
    const api = client(
      step === "sources" ? { listSources: fail } : { listPlans: fail },
    );
    render(<QueryWorkbench client={api} canWrite />);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Demo access denied",
    );
  },
);

it.each(["cached", "pending"])(
  "isolates %s schema metadata when the client changes with identical source IDs",
  async (mode) => {
    const oldSchema = deferred<SourceSchema>();
    const a = client(
      mode === "pending"
        ? { schema: vi.fn(async () => oldSchema.promise) }
        : {},
    );
    const b = client({
      schema: vi.fn(async () => ({
        projectId: "analytics-prod",
        datasets: [{ name: "demo-new", location: "US", tables: [] }],
        truncated: false,
      })),
    });
    const view = render(
      <QueryWorkbench
        client={a}
        sourceId="warehouse"
        planId="daily"
        canWrite
      />,
    );
    await waitFor(() => expect(a.schema).toHaveBeenCalledOnce(), {
      timeout: 1500,
    });
    view.rerender(
      <QueryWorkbench
        client={b}
        sourceId="warehouse"
        planId="daily"
        canWrite
      />,
    );
    await waitFor(() => expect(b.schema).toHaveBeenCalledOnce(), {
      timeout: 1500,
    });
    await act(async () =>
      oldSchema.resolve({
        projectId: "analytics-prod",
        datasets: [{ name: "old-demo", location: "US", tables: [] }],
        truncated: false,
      }),
    );
    expect(screen.queryByRole("button", { name: /old-demo/ })).toBeNull();
  },
);

it("does not create an empty draft for a linked saved plan while loading or when absent", async () => {
  let finish!: (plans: QueryPlan[]) => void;
  const api = client({
    listPlans: vi.fn(
      () =>
        new Promise<QueryPlan[]>((resolve) => {
          finish = resolve;
        }),
    ),
  });
  render(
    <QueryWorkbench
      client={api}
      sourceId="warehouse"
      planId="missing"
      canWrite
    />,
  );
  await waitFor(() => expect(api.listPlans).toHaveBeenCalled());
  expect(screen.queryByLabelText("SQL")).toBeNull();
  await act(async () => finish([]));
  expect(screen.queryByLabelText("SQL")).toBeNull();
  expect(api.createPlan).not.toHaveBeenCalled();
});

it("includes the actual source in plan navigation for implicit source hosts", async () => {
  const changePlan = vi.fn();
  const api = client();
  render(<QueryWorkbench client={api} onPlanChange={changePlan} canWrite />);
  fireEvent.click(await screen.findByRole("button", { name: "Daily trips" }));
  expect(changePlan).toHaveBeenLastCalledWith("daily", "warehouse");
});

it("keeps controlled source changes and query clearing in the same source context", async () => {
  const changeSource = vi.fn(),
    changePlan = vi.fn();
  const api = client({
    listSources: vi.fn(async () => [
      {
        id: "warehouse",
        label: "Warehouse",
        kind: "BIGQUERY" as const,
        defaultProjectId: "analytics-prod",
      },
      {
        id: "demo-next",
        label: "Demo next",
        kind: "BIGQUERY" as const,
        defaultProjectId: "demo-project",
      },
    ]),
  });
  render(
    <QueryWorkbench
      client={api}
      sourceId="warehouse"
      onSourceChange={changeSource}
      onPlanChange={changePlan}
      canWrite
    />,
  );
  await screen.findByRole("button", { name: "Daily trips" });
  fireEvent.change(screen.getByLabelText("Source"), {
    target: { value: "demo-next" },
  });
  expect(changeSource).toHaveBeenLastCalledWith("demo-next");
  expect(changePlan).toHaveBeenLastCalledWith(null, "demo-next");
});
