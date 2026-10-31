import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const swr = vi.hoisted(() => ({ useSWR: vi.fn(), mutate: vi.fn() }));
vi.mock("swr", () => ({ default: swr.useSWR, mutate: swr.mutate }));

import {
  refreshSymptoms,
  saveAsTemplate,
  saveDraft,
  useDataSources,
  useSymptomDefinitions,
} from "./maintainer-api";
import {
  ORG_SYMPTOMS,
  PLATFORM_TEMPLATES,
  SymptomScopeProvider,
} from "./symptom-scope";

const fetchMock = vi.fn();

function respond(body: unknown) {
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify(body), { status: 200 })
  );
}

const platform = ({ children }: { children: ReactNode }) => (
  <SymptomScopeProvider value={PLATFORM_TEMPLATES}>
    {children}
  </SymptomScopeProvider>
);

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  swr.useSWR.mockReset();
  swr.mutate.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("symptom scope", () => {
  it("keeps the organization's catalog as the default", () => {
    renderHook(() => useSymptomDefinitions());
    expect(swr.useSWR.mock.calls[0]?.[0]).toBe(ORG_SYMPTOMS.defs);
    expect(ORG_SYMPTOMS.defs).toMatch(
      /\/api\/control-tower\/symptom-definitions$/
    );
  });

  it("reads the templates and their sources under the platform scope", () => {
    renderHook(
      () => {
        useSymptomDefinitions();
        useDataSources();
      },
      { wrapper: platform }
    );
    expect(swr.useSWR.mock.calls.map((c) => c[0])).toEqual([
      PLATFORM_TEMPLATES.defs,
      PLATFORM_TEMPLATES.sources,
    ]);
    // The templates are the platform scope's symptoms, on the organization endpoints.
    expect(PLATFORM_TEMPLATES.defs).toMatch(/\/symptom-definitions$/);
  });

  it("sends a draft to the scope it is given", async () => {
    respond({});
    await saveDraft("s1", {} as never);
    await saveDraft("t1", {} as never, PLATFORM_TEMPLATES);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      `${ORG_SYMPTOMS.defs}/s1/draft`,
      `${PLATFORM_TEMPLATES.defs}/t1/draft`,
    ]);
  });

  it("refreshes no stats for templates", async () => {
    await refreshSymptoms("t1", PLATFORM_TEMPLATES);
    expect(swr.mutate.mock.calls.map((c) => c[0])).toEqual([
      PLATFORM_TEMPLATES.defs,
      `${PLATFORM_TEMPLATES.defs}/t1`,
    ]);
  });
});

describe("saveAsTemplate", () => {
  it("posts on the organization's symptom and refreshes the template", async () => {
    respond({ definition: { id: "t9" } });
    const saved = await saveAsTemplate("s1", {
      version: "1.2.0",
      templateKey: "speeding",
      name: null,
    });

    expect(saved.definition.id).toBe("t9");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${ORG_SYMPTOMS.defs}/s1/save-as-template`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      version: "1.2.0",
      templateKey: "speeding",
      name: null,
    });
    expect(swr.mutate).toHaveBeenCalledWith(PLATFORM_TEMPLATES.defs);
    expect(swr.mutate).toHaveBeenCalledWith(`${PLATFORM_TEMPLATES.defs}/t9`);
  });
});
