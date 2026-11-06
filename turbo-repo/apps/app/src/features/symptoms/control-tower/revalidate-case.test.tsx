import { act, cleanup, render, screen } from "@testing-library/react";
import { mutate, SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTreatmentsGeneral } from "../hooks/use-treatments-general";
import { useTreatmentsLocation } from "@/features/common/providers/client-api.provider";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";
import {
  guardedFinishTreatment,
  guardedRequestTreatment,
  guardedSkipStep,
} from "../components/map-view/prototype/prototype-api-guard";
import {
  TreatmentSessionProvider,
  useTreatmentSession,
} from "../components/map-view/prototype/treatment-session";
import {
  CONTROL_TOWER_BASE,
  isCaseKey,
  treatmentsKey,
  useSymptomTreatments,
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
    `${CONTROL_TOWER_BASE}/map/symptoms/-7/context`,
    "/app/api/treatments/location?symptom_id=%2D7&symptom_name=Exceso",
    "/app/api/symptoms/icu",
    "/app/api/symptoms/table?page=1",
  ])("matches %s for case -7", (key) => {
    expect(isCaseKey(-7, key)).toBe(true);
  });

  it.each([
    "/app/api/treatments/general?id=-70",
    "/app/api/treatments/location?symptom_name=Exceso&symptom_id=-70",
    treatmentsKey(-70),
    `${CONTROL_TOWER_BASE}/map/symptoms/-70/timeline`,
    "/app/api/treatments/location?symptom_name=Exceso",
    "/app/api/map",
    ["array", "key"],
    null,
  ])("leaves %s alone", (key) => {
    expect(isCaseKey(-7, key)).toBe(false);
  });
});

/** The general-treatments API: one timeline treatment per saved action. */
function stubBackend(failClose = false) {
  let saved = 0;
  let closed = false;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "POST" && url.endsWith("/treatments")) {
      return Response.json({ id: "t1", status: "OPEN", actions: [] });
    }
    if (method === "POST" && url.endsWith("/actions")) {
      saved += 1;
      return Response.json({ id: `a${saved}` });
    }
    if (method === "POST" && url.endsWith("/close")) {
      if (failClose)
        return Response.json({ error: "close failed" }, { status: 500 });
      closed = true;
      return Response.json({ id: "t1", status: "CLOSED", actions: [] });
    }
    if (url.startsWith("/app/api/treatments/general")) {
      const treatments = Array.from({ length: saved + 1 }, (_, i) => ({
        treatment_type: i === 0 ? "apertura" : `nota ${i}`,
        description: {},
      }));
      if (closed)
        treatments.push({ treatment_type: "cierre", description: {} });
      return Response.json({
        timeline: [{ start: "", end: "", conditions_agg: [{ treatments }] }],
      });
    }
    if (url.startsWith("/app/api/treatments/location?")) {
      return Response.json({
        closed: true,
        description: { symptom_name: `señales ${saved}` },
      });
    }
    if (url.endsWith("/treatments")) {
      return Response.json([{ actions: Array.from({ length: saved }) }]);
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

function OtherViews({ id }: Readonly<{ id: number }>) {
  const { data: location } = useTreatmentsLocation("", "Exceso", String(id));
  const { data: treatments } = useSymptomTreatments(id);
  return (
    <>
      <p>{location?.description.symptom_name}</p>
      <p>acciones {treatments?.[0]?.actions.length ?? 0}</p>
    </>
  );
}

let session: ReturnType<typeof useTreatmentSession>;
function Session() {
  session = useTreatmentSession();
  return null;
}

/** The default SWR cache, as in the app, where `revalidateCase` writes. */
function renderCase(id: number, children?: React.ReactNode) {
  render(
    <SWRConfig value={{ dedupingInterval: 0 }}>
      <TreatmentSessionProvider symptomId={id}>
        <Timeline id={String(id)} />
        <OtherViews id={id} />
        {children}
      </TreatmentSessionProvider>
    </SWRConfig>
  );
}

describe("the case timeline after a save", () => {
  beforeEach(() => {
    stubBackend();
  });
  afterEach(async () => {
    cleanup();
    await mutate(() => true, undefined, { revalidate: false });
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
    expect(await screen.findByText("señales 1")).toBeTruthy();
    expect(await screen.findByText("acciones 1")).toBeTruthy();
  });

  it("shows an action saved in the treatment session without a reload", async () => {
    renderCase(-8, <Session />);
    expect(await screen.findByText("apertura")).toBeTruthy();

    await act(() => session.addAction({ kind: "NOTE", note: "sin respuesta" }));

    expect(await screen.findByText("nota 1")).toBeTruthy();
    await act(() => session.finish());
    expect(await screen.findByText("cierre")).toBeInTheDocument();
  });

  const request: TreatmentsRequest = {
    asset_id: "asset-test",
    assigned_to: "operator@example.test",
    client_id: null,
    status: "active",
    symptom_id: "-9",
    treatment_type: "",
    treatment_id: null,
    trip_id: "",
  };

  it.each([
    { name: "call result", type: "", finish: true },
    { name: "hold", type: "ignorar condicion", finish: false },
    { name: "invalidation", type: "invalidar sintoma", finish: true },
  ])("shows a saved $name without a reload", async ({ type, finish }) => {
    renderCase(-9);
    await screen.findByText("apertura");

    await act(() =>
      guardedRequestTreatment({ ...request, treatment_type: type }, { finish })
    );

    expect(await screen.findByText("nota 1")).toBeInTheDocument();
    expect(await screen.findByText("señales 1")).toBeInTheDocument();
    expect(await screen.findByText("acciones 1")).toBeInTheDocument();
    if (finish) expect(await screen.findByText("cierre")).toBeInTheDocument();
  });

  it("shows the close of a previously saved call without a reload", async () => {
    renderCase(-9);
    await screen.findByText("apertura");
    await act(() => guardedRequestTreatment(request, { finish: false }));
    await screen.findByText("nota 1");

    await act(() => guardedFinishTreatment(request));

    expect(await screen.findByText("cierre")).toBeInTheDocument();
  });

  it("shows an acknowledged action even when the later close fails", async () => {
    stubBackend(true);
    renderCase(-9);
    await screen.findByText("apertura");

    await act(async () => {
      await expect(guardedRequestTreatment(request)).rejects.toThrow(
        "close failed"
      );
    });

    expect(await screen.findByText("nota 1")).toBeInTheDocument();
  });
});
