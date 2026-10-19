import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useReducer } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { HarnessChatI18nProvider } from "@/features/harness-chat/context/harness-chat-i18n-context";
import type { WorkItem } from "@/features/harness-chat/context/work-area-context";
import type { KnowledgeChange } from "@/features/harness-chat/extensions/knowledge-change-args";
import {
  currentItem,
  INITIAL_WORK_AREA,
  MAX_RECENT_ITEMS,
  workAreaReducer,
  type WorkAreaState,
} from "../work-area-state";
import { WorkAreaPanel } from "./work-area-panel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const file = (id: string): WorkItem => ({
  kind: "file",
  layer: "rule",
  id,
  target: null,
  path: `rules/${id}.md`,
});

describe("workAreaReducer", () => {
  it("opens the area on the item it opens", () => {
    const state = workAreaReducer(INITIAL_WORK_AREA, {
      type: "open",
      item: file("a"),
    });
    expect(state.open).toBe(true);
    expect(currentItem(state)).toEqual(file("a"));
  });

  it("moves a reopened item to the end instead of repeating it", () => {
    let state = INITIAL_WORK_AREA;
    for (const id of ["a", "b", "a"])
      state = workAreaReducer(state, { type: "open", item: file(id) });
    expect(state.items.map((i) => (i.kind === "file" ? i.id : i.kind))).toEqual(
      ["b", "a"]
    );
    expect(state.index).toBe(1);
  });

  it("goes back and forward within the recent items only", () => {
    let state = INITIAL_WORK_AREA;
    for (const id of ["a", "b"])
      state = workAreaReducer(state, { type: "open", item: file(id) });
    state = workAreaReducer(state, { type: "back" });
    expect(state.index).toBe(0);
    expect(workAreaReducer(state, { type: "back" })).toBe(state);
    state = workAreaReducer(state, { type: "forward" });
    expect(state.index).toBe(1);
    expect(workAreaReducer(state, { type: "forward" })).toBe(state);
  });

  it("keeps the recent items when it closes, and a bounded number of them", () => {
    let state: WorkAreaState = INITIAL_WORK_AREA;
    for (let i = 0; i < MAX_RECENT_ITEMS + 5; i++) {
      state = workAreaReducer(state, { type: "open", item: file(`f${i}`) });
    }
    expect(state.items).toHaveLength(MAX_RECENT_ITEMS);
    state = workAreaReducer(state, { type: "close" });
    expect(state.open).toBe(false);
    state = workAreaReducer(state, { type: "toggle" });
    expect(state.open).toBe(true);
    expect(currentItem(state)).toEqual(file(`f${MAX_RECENT_ITEMS + 4}`));
    expect(workAreaReducer(state, { type: "go", index: 0 }).index).toBe(0);
    expect(workAreaReducer(state, { type: "go", index: 99 })).toBe(state);
  });
});

const layers = {
  layers: [
    {
      layer: "fact",
      label: "Data facts",
      editable: true,
      targets: ["trips"],
      items: [
        {
          id: "states",
          title: "Trip states",
          target: "trips",
          updated_at: null,
          updated_by: "",
          version: 1,
        },
      ],
    },
    {
      layer: "rule",
      label: "Rules and glossary",
      editable: true,
      targets: [],
      items: [
        {
          id: "loaded",
          title: "Loaded trips",
          target: null,
          updated_at: null,
          updated_by: "",
          version: 2,
        },
      ],
    },
    {
      layer: "note",
      label: "Agent notes",
      editable: false,
      targets: [],
      items: [],
    },
  ],
};

const itemV2 = {
  layer: "rule",
  id: "loaded",
  target: null,
  title: "Loaded trips",
  content: "# Loaded\nA loaded trip was sent to tracking.\n",
  meta: {},
  version: 2,
  updated_at: "2026-09-01T10:00:00Z",
  updated_by: "ana@example.com",
  history: [
    {
      version: 2,
      updated_at: "2026-09-01T10:00:00Z",
      updated_by: "ana@example.com",
      reason: "clarify",
    },
    {
      version: 1,
      updated_at: "2026-08-01T10:00:00Z",
      updated_by: "ana@example.com",
      reason: "first",
    },
  ],
};

const itemV1 = {
  ...itemV2,
  version: 1,
  content: "# Loaded\nA loaded trip is planned.\n",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? "GET";
  if (url.endsWith("/api/harness/knowledge/layers")) return json(layers);
  if (url.includes("/items/rule/loaded/versions/1")) return json(itemV1);
  if (url.includes("/items/rule/loaded/revert"))
    return json({ ...itemV1, version: 3 });
  if (url.includes("/items/rule/loaded") && method === "PUT")
    return json({ ...itemV2, version: 3 });
  if (url.includes("/items/rule/loaded")) return json(itemV2);
  return json({}, 404);
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Harness({
  initial,
  changes = [],
}: {
  initial?: WorkItem;
  changes?: KnowledgeChange[];
}) {
  const [state, dispatch] = useReducer(
    workAreaReducer,
    initial
      ? workAreaReducer(INITIAL_WORK_AREA, { type: "open", item: initial })
      : INITIAL_WORK_AREA
  );
  return (
    <WorkAreaPanel
      state={state}
      dispatch={dispatch}
      onOpen={(item) => dispatch({ type: "open", item })}
      changesOf={() => changes}
    />
  );
}

function renderArea(props: {
  initial?: WorkItem;
  changes?: KnowledgeChange[];
}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
        <Harness {...props} />
      </HarnessChatI18nProvider>
    </SWRConfig>
  );
}

describe("WorkAreaPanel", () => {
  it("stays closed until something is opened", () => {
    const { container } = renderArea({});
    expect(container.querySelector("aside")).toBeNull();
  });

  it("is a full-height overlay on narrow screens and a side panel on wide ones", () => {
    renderArea({ initial: { kind: "layers" } });
    const area = screen.getByRole("complementary", { name: "Área de trabajo" });
    expect(area.className).toContain("fixed inset-0");
    expect(area.className).toContain("lg:relative");
  });

  it("navigates from the layers tree to a file and back and forth", async () => {
    renderArea({ initial: { kind: "layers" } });
    fireEvent.click(await screen.findByText("Loaded trips"));

    expect(await screen.findByText("loaded.md")).toBeTruthy();
    expect(screen.getByText("Versión 2 contra la anterior")).toBeTruthy();
    await waitFor(() =>
      expect(
        document.querySelectorAll(".diff-code-insert").length
      ).toBeGreaterThan(0)
    );

    fireEvent.click(screen.getByLabelText("Atrás"));
    expect(await screen.findByText("Trip states")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Adelante"));
    expect(await screen.findByText("loaded.md")).toBeTruthy();
  });

  it("groups facts by their connection", async () => {
    renderArea({ initial: { kind: "layers" } });
    expect(await screen.findByText("trips")).toBeTruthy();
    expect(screen.getByText(/Notas del agente \(solo lectura\)/)).toBeTruthy();
  });

  it("shows the whole file and the history of versions", async () => {
    renderArea({ initial: file("loaded") });
    fireEvent.click(await screen.findByRole("button", { name: /Archivo/ }));
    expect(
      await screen.findByText(/A loaded trip was sent to tracking/)
    ).toBeTruthy();
    expect(screen.getByText("v1")).toBeTruthy();
    expect(screen.getByText("first")).toBeTruthy();
  });

  it("reverts to an earlier version after confirming", async () => {
    renderArea({ initial: file("loaded") });
    fireEvent.click(await screen.findByRole("button", { name: "Revertir" }));
    expect(screen.getByText(/¿Restaurar la versión 1\?/)).toBeTruthy();
    const confirm = screen.getAllByRole("button", { name: "Revertir" }).at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/harness/knowledge/items/rule/loaded/revert",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ version: 1 }),
        })
      )
    );
  });

  it("saves a manual edit as a new version", async () => {
    renderArea({ initial: file("loaded") });
    fireEvent.click(await screen.findByRole("button", { name: /Editar/ }));
    fireEvent.change(screen.getByLabelText("Contenido"), {
      target: { value: "# Loaded\nNew text\n" },
    });
    fireEvent.change(screen.getByLabelText("Motivo del cambio"), {
      target: { value: "by hand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar versión" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/harness/knowledge/items/rule/loaded",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            title: "Loaded trips",
            content: "# Loaded\nNew text\n",
            reason: "by hand",
          }),
        })
      )
    );
  });

  it("shows a proposed change above the file's own history", async () => {
    const proposed: KnowledgeChange = {
      path: "rules/loaded.md",
      layer: "rule",
      id: "loaded",
      target: null,
      op: "edit",
      diff: "--- a/rules/loaded.md\n+++ b/rules/loaded.md\n@@ -1 +1 @@\n-# Loaded\n+# Loaded trips\n",
      title: null,
      content: null,
      reason: null,
      version: null,
    };
    renderArea({
      initial: {
        ...(file("loaded") as Extract<WorkItem, { kind: "file" }>),
        proposed,
      },
    });
    expect(await screen.findByText("Cambio propuesto")).toBeTruthy();
  });

  it("lists the session's changes", () => {
    const change: KnowledgeChange = {
      path: "rules/loaded.md",
      layer: "rule",
      id: "loaded",
      target: null,
      op: "write",
      diff: "--- a/rules/loaded.md\n+++ b/rules/loaded.md\n@@ -0,0 +1 @@\n+hola\n",
      title: null,
      content: null,
      reason: null,
      version: 1,
    };
    renderArea({
      initial: { kind: "changes", threadId: "t1" },
      changes: [change],
    });
    const area = screen.getByRole("complementary");
    expect(within(area).getByText("Cambios de la sesión")).toBeTruthy();
    expect(within(area).getByText("loaded.md")).toBeTruthy();
  });

  it("closes", () => {
    const { container } = renderArea({ initial: { kind: "layers" } });
    fireEvent.click(screen.getByLabelText("Cerrar el área de trabajo"));
    expect(container.querySelector("aside")).toBeNull();
  });
});
