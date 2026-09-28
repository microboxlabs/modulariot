import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { HarnessChatI18nProvider } from "../../context/harness-chat-i18n-context";
import { HarnessReadOnlyProvider } from "../../context/harness-read-only-context";
import {
  WorkAreaProvider,
  type WorkItem,
} from "../../context/work-area-context";
import { SWRConfig } from "swr";
import type {
  RequestApprovalArgs,
  RequestApprovalResult,
} from "../request-approval-args";
import { RequestApprovalCard } from "./request-approval-card";

type Props = ComponentProps<typeof RequestApprovalCard>;

const content = Array.from({ length: 30 }, (_, i) => `línea ${i + 1}`).join(
  "\n"
);

const storyArgs: RequestApprovalArgs = {
  runId: "run_1",
  approvalId: "aid_1",
  tool: "stories_create",
  input: {
    title: "Informe de viajes",
    kind: "markdown",
    description: "Resumen de enero",
    version: { content },
  },
};

const connectionArgs: RequestApprovalArgs = {
  runId: "run_1",
  approvalId: "aid_2",
  tool: "connections_create",
  input: {
    name: "crm",
    baseUrl: "https://crm.example.com",
    credentialProfileId: "[redacted]",
    apiKey: "sk-should-not-show",
  },
};

function renderCard(
  props: { args?: RequestApprovalArgs; result?: RequestApprovalResult },
  readOnly = false
) {
  const all = {
    args: storyArgs,
    addResult: vi.fn(),
    ...props,
  } as unknown as Props;
  return render(
    <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
      <HarnessReadOnlyProvider readOnly={readOnly}>
        <RequestApprovalCard {...all} />
      </HarnessReadOnlyProvider>
    </HarnessChatI18nProvider>
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RequestApprovalCard", () => {
  it("titles a story by its action and shows the first lines of its content", () => {
    renderCard({});
    expect(
      screen.getByText("Guardar historia «Informe de viajes»")
    ).toBeTruthy();
    expect(screen.getByText("Resumen de enero")).toBeTruthy();
    const preview = screen.getByLabelText("Contenido");
    expect(preview.textContent).toContain("línea 20");
    expect(preview.textContent).not.toContain("línea 21");
    fireEvent.click(screen.getByText("Ver todo"));
    expect(screen.getByLabelText("Contenido").textContent).toContain(
      "línea 30"
    );
  });

  it("lists other inputs without secrets", () => {
    renderCard({ args: connectionArgs });
    expect(screen.getByText("Crear conexión «crm»")).toBeTruthy();
    expect(screen.getByText("https://crm.example.com")).toBeTruthy();
    expect(screen.queryByText("sk-should-not-show")).toBeNull();
    expect(screen.queryByText("credentialProfileId")).toBeNull();
  });

  it("falls back to the tool's name for an unknown action", () => {
    renderCard({
      args: { ...connectionArgs, tool: "tickets_open", input: {} },
    });
    expect(screen.getByText("tickets_open")).toBeTruthy();
  });

  it("posts an approval for the run", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    renderCard({});

    fireEvent.click(screen.getByText("Aprobar"));

    await waitFor(() =>
      expect(screen.getByText(/Decisión enviada/)).toBeTruthy()
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/harness/chat/runs/run_1/approvals/aid_1");
    expect(JSON.parse(init.body)).toEqual({ decision: "approve" });
    expect((screen.getByText("Aprobar") as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it("posts a rejection with its comment", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    renderCard({});

    fireEvent.click(screen.getByText("Rechazar"));
    fireEvent.change(screen.getByPlaceholderText("Motivo (opcional)"), {
      target: { value: "otro título" },
    });
    fireEvent.click(screen.getByText("Confirmar rechazo"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      decision: "deny",
      comment: "otro título",
    });
  });

  it("says so when the approval is no longer pending", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    renderCard({});
    fireEvent.click(screen.getByText("Aprobar"));
    await waitFor(() =>
      expect(
        screen.getByText("Esta solicitud ya no está pendiente.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("Aprobar")).toBeNull();
  });

  it("shows the decision and no buttons once resolved", () => {
    renderCard({
      result: {
        status: "rejected",
        by: "ana@example.com",
        at: "2026-09-28T12:00:00Z",
        comment: "otro título",
      },
    });
    expect(screen.getByRole("status").textContent).toContain("Rechazado");
    expect(screen.getByRole("status").textContent).toContain(
      "por ana@example.com"
    );
    expect(screen.getByText("“otro título”")).toBeTruthy();
    expect(screen.queryByText("Aprobar")).toBeNull();
    expect(screen.queryByText("Se necesita tu aprobación")).toBeNull();
  });

  it("offers no buttons in a read-only thread", () => {
    renderCard({}, true);
    expect(screen.queryByText("Aprobar")).toBeNull();
  });

  describe("a learned fact", () => {
    const factArgs: RequestApprovalArgs = {
      runId: "run_1",
      approvalId: "aid_3",
      tool: "propose_learned_fact",
      input: {
        connection: "procesos",
        term: "proceso vigente",
        title: "Solo la v152 del proceso está vigente",
        kind: "gotcha",
        body: "Solo la versión **v152** está vigente.",
      },
    };

    it("shows the fact with its body as markdown, not the raw input", () => {
      renderCard({ args: factArgs });
      expect(
        screen.getByText(
          "Guardar hecho aprendido «Solo la v152 del proceso está vigente»"
        )
      ).toBeTruthy();
      expect(screen.getByText(/Conexión: procesos/)).toBeTruthy();
      expect(screen.getByText("v152").tagName).toBe("STRONG");
      expect(screen.queryByText("proceso vigente")).toBeNull();
    });

    it("says it was saved once approved", () => {
      renderCard({ args: factArgs, result: { status: "approved" } });
      expect(screen.getByRole("status").textContent).toContain(
        "Guardado en hechos aprendidos"
      );
    });

    it("says it was rejected when declined", () => {
      renderCard({ args: factArgs, result: { status: "rejected" } });
      expect(screen.getByRole("status").textContent).toContain("Rechazado");
    });
  });

  describe("knowledge changes", () => {
    const diff = [
      "--- a/rules/loaded-trips.md",
      "+++ b/rules/loaded-trips.md",
      "@@ -1,2 +1,2 @@",
      " # Loaded trips",
      "-A loaded trip is planned.",
      "+A loaded trip was sent to tracking.",
      "",
    ].join("\n");

    const editArgs: RequestApprovalArgs = {
      runId: "run_1",
      approvalId: "aid_4",
      tool: "ws_edit",
      input: {
        path: "rules/loaded-trips.md",
        layer: "rule",
        op: "edit",
        diff,
        old_lines: 2,
        new_lines: 2,
      },
    };

    function renderChange(
      args: RequestApprovalArgs,
      open?: (item: WorkItem) => void
    ) {
      const all = { args, addResult: vi.fn() } as unknown as Props;
      const card = <RequestApprovalCard {...all} />;
      return render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
            {open ? (
              <WorkAreaProvider value={{ open, recordChange: vi.fn() }}>
                {card}
              </WorkAreaProvider>
            ) : (
              card
            )}
          </HarnessChatI18nProvider>
        </SWRConfig>
      );
    }

    it("shows a file edit as a diff with its path, layer and operation", () => {
      renderChange(editArgs);
      expect(
        screen.getByText("Editar archivo «rules/loaded-trips.md»")
      ).toBeTruthy();
      expect(screen.getByText("loaded-trips.md")).toBeTruthy();
      expect(screen.getByText("Reglas y glosario")).toBeTruthy();
      expect(screen.getByText("Editar")).toBeTruthy();
      expect(screen.getByText("+1")).toBeTruthy();
      expect(document.querySelector(".diff-code-insert")).toBeTruthy();
      expect(screen.queryByText("old_lines")).toBeNull();
    });

    it("approves or rejects with a comment through the usual flow", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      renderChange(editArgs);
      fireEvent.click(screen.getByText("Rechazar"));
      fireEvent.change(screen.getByPlaceholderText("Motivo (opcional)"), {
        target: { value: "usa otro nombre" },
      });
      fireEvent.click(screen.getByText("Confirmar rechazo"));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/api/harness/chat/runs/run_1/approvals/aid_4");
      expect(JSON.parse(init.body)).toEqual({
        decision: "deny",
        comment: "usa otro nombre",
      });
    });

    it("opens the proposed change in the working area", () => {
      const open = vi.fn();
      renderChange(editArgs, open);
      fireEvent.click(screen.getByLabelText("Abrir en el área de trabajo"));
      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "file",
          layer: "rule",
          id: "loaded-trips",
          path: "rules/loaded-trips.md",
          proposed: expect.objectContaining({ diff }),
        })
      );
    });

    it("diffs a proposed change without a diff against the item as it is now", async () => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            layer: "rule",
            id: "loaded",
            content: "old line\n",
            history: [],
          }),
          { status: 200 }
        )
      );
      renderChange({
        runId: "run_1",
        approvalId: "aid_5",
        tool: "propose_knowledge_change",
        input: {
          summary: "Teach what a loaded trip is",
          changes: [
            {
              layer: "rule",
              id: "loaded",
              target: null,
              op: "upsert",
              title: "Loaded",
              content: "new line\n",
              reason: "glossary",
            },
          ],
        },
      });
      expect(screen.getByText("Aplicar cambios de conocimiento")).toBeTruthy();
      expect(screen.getByText("Teach what a loaded trip is")).toBeTruthy();
      expect(screen.getByText("glossary")).toBeTruthy();
      await waitFor(() => expect(screen.getByText("−1")).toBeTruthy());
      expect(fetchMock.mock.calls[0]![0]).toBe(
        "/api/harness/knowledge/items/rule/loaded"
      );
    });
  });
});
