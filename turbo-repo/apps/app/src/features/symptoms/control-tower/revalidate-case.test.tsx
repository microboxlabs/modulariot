import { act, cleanup, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTreatmentsGeneral } from "../hooks/use-treatments-general";
import { guardedSkipStep } from "../components/map-view/prototype/prototype-api-guard";
import {
  TreatmentSessionProvider,
  useTreatmentSession,
} from "../components/map-view/prototype/treatment-session";
import {
  CONTROL_TOWER_BASE,
  isCaseKey,
  treatmentsKey,
} from "./control-tower-api";

vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  getRuntimeConfig: () => ({}),
}));

describe("isCaseKey", () => {
  it.each([
    "/app/api/treatments/general?id=-7",
    "/app/api/treatments/location?trip_id=T1&symptom_name=Exceso&symptom_id=-7",
    "/app/api/treatments/location?symptom_name=Exceso&symptom_id=-7",
    treatmentsKey(-7),
    `${CONTROL_TOWER_BASE}/map/symptoms/-7/timeline`,
    "/app/api/symptoms/icu",
    "/app/api/symptoms/table?page=1",
  ])("matches %s for case -7", (key) => {
    expect(isCaseKey(-7, key)).toBe(true);
  });

  it.each([
    "/app/api/treatments/general?id=-70",
    "/app/api/treatments/location?symptom_name=Exceso&symptom_id=-70",
    treatmentsKey(-70),
    "/app/api/map",
    ["array", "key"],
    null,
  ])("leaves %s alone", (key) => {
    expect(isCaseKey(-7, key)).toBe(false);
  });
});

/** The general-treatments API: one timeline treatment per saved action. */
function stubBackend() {
  let saved = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "POST" && url.endsWith("/treatments")) {
      return Response.json({ id: "t1", status: "OPEN", actions: [] });
    }
    if (method === "POST" && url.endsWith("/actions")) {
      saved += 1;
      return Response.json({ id: `a${saved}` });
    }
    if (url.startsWith("/app/api/treatments/general")) {
      const treatments = Array.from({ length: saved + 1 }, (_, i) => ({
        treatment_type: i === 0 ? "apertura" : `nota ${i}`,
        description: {},
      }));
      return Response.json({
        timeline: [{ start: "", end: "", conditions_agg: [{ treatments }] }],
      });
    }
    return Response.json([]);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function Timeline({ id }: Readonly<{ id: string }>) {
  const { treatmentData } = useTreatmentsGeneral(id);
  const rows =
    treatmentData?.timeline?.flatMap((t) =>
      (t.conditions_agg ?? []).flatMap((c) => c.treatments)
    ) ?? [];
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.treatment_type}>{row.treatment_type}</li>
      ))}
    </ul>
  );
}

let addAction: ReturnType<typeof useTreatmentSession>["addAction"];
function Session() {
  addAction = useTreatmentSession().addAction;
  return null;
}

/** The default SWR cache, as in the app, where `revalidateCase` writes. */
function renderCase(id: number, children?: React.ReactNode) {
  render(
    <SWRConfig value={{ dedupingInterval: 0 }}>
      <TreatmentSessionProvider symptomId={id}>
        <Timeline id={String(id)} />
        {children}
      </TreatmentSessionProvider>
    </SWRConfig>
  );
}

describe("the case timeline after a save", () => {
  beforeEach(() => {
    stubBackend();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a call-step skip note without a reload", async () => {
    renderCase(-7);
    expect(await screen.findByText("apertura")).toBeTruthy();

    await act(() =>
      guardedSkipStep({
        symptomId: -7,
        toStep: 1,
        reason: "no contesta",
        skipId: "skip-1",
      })
    );

    expect(await screen.findByText("nota 1")).toBeTruthy();
  });

  it("shows an action saved in the treatment session without a reload", async () => {
    renderCase(-8, <Session />);
    expect(await screen.findByText("apertura")).toBeTruthy();

    await act(() => addAction({ kind: "NOTE", note: "sin respuesta" }));

    expect(await screen.findByText("nota 1")).toBeTruthy();
  });
});
