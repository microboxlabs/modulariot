import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKnowledgeCandidates } from "./use-knowledge-candidates";
import { useKnowledgeCards } from "./use-knowledge-cards";
import { useKnowledgeTrainer } from "./use-knowledge-trainer";

const fetcherMock = vi.fn();
vi.mock("@/features/common/providers/fetcher", () => ({
  default: (...args: unknown[]) => fetcherMock(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

describe("knowledge hooks", () => {
  beforeEach(() => {
    fetcherMock.mockReset();
  });

  it("reports whether the caller is a trainer", async () => {
    fetcherMock.mockResolvedValue({ trainer: true });
    const { result } = renderHook(() => useKnowledgeTrainer(), { wrapper });
    await waitFor(() => expect(result.current.isTrainer).toBe(true));
    expect(fetcherMock).toHaveBeenCalledWith("/app/api/knowledge/trainer");
  });

  it("does not load cards until enabled", () => {
    renderHook(() => useKnowledgeCards(false), { wrapper });
    expect(fetcherMock).not.toHaveBeenCalled();
  });

  it("loads cards and deletes one, then reloads", async () => {
    fetcherMock.mockImplementation(async (url: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? undefined
        : { connections: [{ connection: "a", cards: [] }] }
    );
    const { result } = renderHook(() => useKnowledgeCards(true), { wrapper });
    await waitFor(() => expect(result.current.connections).toHaveLength(1));

    await act(() => result.current.remove("a b", "card/1"));

    expect(fetcherMock).toHaveBeenCalledWith(
      "/app/api/knowledge/cards/a%20b/card%2F1",
      {
        method: "DELETE",
      }
    );
    expect(
      fetcherMock.mock.calls.filter(
        ([url]) => url === "/app/api/knowledge/cards"
      ).length
    ).toBeGreaterThanOrEqual(2);
  });

  it("edits a candidate with a PATCH", async () => {
    fetcherMock.mockResolvedValue({ candidates: [] });
    const { result } = renderHook(() => useKnowledgeCandidates(), { wrapper });

    await act(() => result.current.edit("c1", { term: "t", body: "b" }));

    expect(fetcherMock).toHaveBeenCalledWith(
      "/app/api/knowledge/candidates/c1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: "t", body: "b" }),
      }
    );
  });
});
